import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Sirve tus archivos HTML/CSS/JS

// Configuración del Pool (Túnel SSH puerto 3307)
const pool = mysql.createPool({
    host: process.env.DB_HOST || '127.0.0.1',
    port: process.env.DB_PORT || 3307,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Verificación de conexión al arrancar
pool.getConnection()
    .then(conn => {
        console.log('✅ Conexión establecida con Azure vía Puerto 3307');
        conn.release();
    })
    .catch(err => {
        console.error('❌ Error crítico de conexión:', err.message);
    });

// ==========================================
// RUTA DE REGISTRO (Sincronizada con tu DB)
// ==========================================
app.post('/auth/register', async (req, res) => {
    const { nombre, email, password, plan } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // Encriptación requerida por rúbrica
        const salt = await bcrypt.genSalt(10);
        const hashedPwd = await bcrypt.hash(password, salt);

        // 1. Insertar en tabla 'usuario'
        const [userResult] = await connection.query(
            'INSERT INTO usuario (nombre_usuario, pswrd_usuario, email_usuario, fecha_creacion, rol_usuario) VALUES (?, ?, ?, CURDATE(), "usuario")',
            [nombre, hashedPwd, email]
        );
        
        // id_usuario es el nombre real en tu esquema
        const userId = userResult.insertId;

        // 2. Insertar en 'suscripcion_info'
        await connection.query(
            'INSERT INTO suscripcion_info (usuario_id, tipo_plan, estado_suscripcion, fecha_corte) VALUES (?, ?, "activa", DATE_ADD(CURDATE(), INTERVAL 1 MONTH))',
            [userId, plan || 'basico']
        );

        await connection.commit();
        console.log(`-----------------------------------------`);
        console.log(`✅ REGISTRO EXITOSO: ${nombre} (ID: ${userId})`);
        console.log(`-----------------------------------------`);
        
        res.status(201).json({ success: true, message: "Usuario registrado con éxito" });

    } catch (error) {
        await connection.rollback();
        
        // BLOQUE DETECTIVE
        console.error("-----------------------------------------");
        console.error("❌ ERROR CRÍTICO EN SQL (AZURE):");
        console.error("Mensaje:", error.message);
        console.error("Código de Error:", error.code);
        console.error("Query completa:", error.sql);
        console.error("-----------------------------------------");
        
        res.status(500).json({ 
            success: false, 
            message: `Error de Base de Datos: ${error.message}` 
        });
    } finally {
        connection.release();
    }
});

// ==========================================
// RUTA DE LOGIN
// ==========================================
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM usuario WHERE email_usuario = ?', [email]);
        
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: "Usuario no encontrado" });
        }

        const user = rows[0];
        const validPass = await bcrypt.compare(password, user.pswrd_usuario);

        if (!validPass) {
            return res.status(401).json({ success: false, message: "Contraseña incorrecta" });
        }

        res.json({ 
            success: true, 
            user: { id: user.id_usuario, nombre: user.nombre_usuario, rol: user.rol_usuario } 
        });
    } catch (error) {
        console.error("Error en Login:", error.message);
        res.status(500).json({ success: false, message: "Error interno" });
    }
});

// ==========================================
// RUTAS DE DATOS (Food-Loop API)
// ==========================================
app.get('/api/packs', async (req, res) => {
    try {
        // AQUÍ ESTÁ LA REGLA: AND CURTIME() >= hora_activacion
        const [rows] = await pool.query('SELECT * FROM pack WHERE estado = "disponible" AND CURTIME() >= hora_activacion');
        res.json(rows);
    } catch (error) {
        console.error("❌ Error al obtener los packs de Azure:", error.message);
        res.status(500).json({ error: "Error al obtener los packs" });
    }
});

// 4. Crear una reservación (Sincronizado con tu BD)
app.post('/api/reservar', async (req, res) => {
    const { usuario_id, pack_id, cantidad } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Guardamos la reserva en la tabla 'reservacion' usando NOW() para la fecha exacta
        await connection.query(
            'INSERT INTO reservacion (usuario_id, pack_id, cantidad, fecha_reserva, estado_reserva) VALUES (?, ?, ?, NOW(), "pendiente")',
            [usuario_id, pack_id, cantidad || 1]
        );

        // 2. Le restamos el stock a la tabla 'pack' para que no vendamos de más
        await connection.query(
            'UPDATE pack SET stock_disponible = stock_disponible - ? WHERE id_pack = ?',
            [cantidad || 1, pack_id]
        );

        await connection.commit();
        console.log(`✅ ¡Reserva creada! Usuario ${usuario_id} reservó el Pack ${pack_id}`);
        res.status(201).json({ success: true, message: "¡Reserva confirmada!" });

    } catch (error) {
        await connection.rollback();
        console.error("❌ ERROR AL RESERVAR:", error.message);
        res.status(500).json({ success: false, message: "Error al procesar la reserva en Azure" });
    } finally {
        connection.release();
    }
});

// 5. Validar sesión y rol del usuario (GET /me requerido por rúbrica)
app.get('/api/me', async (req, res) => {
    // Como en este proyecto no estamos usando tokens complejos (JWT), 
    // recibiremos el ID del usuario a través de un "header" oculto.
    const userId = req.headers['user-id'];

    if (!userId) {
        return res.status(401).json({ success: false, message: "No autorizado" });
    }

    try {
        // Buscamos al usuario en la base de datos (¡NUNCA pedimos la contraseña aquí por seguridad!)
        const [rows] = await pool.query(
            'SELECT id_usuario, nombre_usuario, email_usuario, rol_usuario FROM usuario WHERE id_usuario = ?',
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Usuario no encontrado" });
        }

        // Si el usuario existe, le devolvemos sus datos frescos
        res.json({ success: true, user: rows[0] });

    } catch (error) {
        console.error("❌ Error en GET /me:", error.message);
        res.status(500).json({ success: false, message: "Error del servidor al validar sesión" });
    }
});

// ==========================================
// INICIO DEL SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
    console.log(`🚀 Food-Loop ejecutándose en http://localhost:${PORT}`);
});