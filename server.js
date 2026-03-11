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

// Configuración del Pool (Conexión directa a Azure MySQL)
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'foodloop-db-v2.mysql.database.azure.com',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        rejectUnauthorized: false // Necesario para la conexión segura con Azure
    }
});

// Verificación de conexión al arrancar
pool.getConnection()
    .then(conn => {
        console.log('✅ Conexión directa establecida con Azure MySQL');
        conn.release();
    })
    .catch(err => {
        console.error('❌ Error crítico de conexión:', err.message);
    });

// ==========================================
// RUTA DE REGISTRO (Sincronizada con tu DB)
// ==========================================
app.post('/auth/register', async (req, res) => {
    const { nombre, email, password, plan, rol, direccion, telefono } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const salt = await bcrypt.genSalt(10);
        const hashedPwd = await bcrypt.hash(password, salt);
        const rolFinal = rol === 'local' ? 'local' : 'usuario';

        // 1. Insertar en tabla 'usuario'
        const [userResult] = await connection.query(
            'INSERT INTO usuario (nombre_usuario, pswrd_usuario, email_usuario, fecha_creacion, rol_usuario) VALUES (?, ?, ?, CURDATE(), ?)',
            [nombre, hashedPwd, email, rolFinal]
        );
        
        const userId = userResult.insertId;

        // 2. Insertar en 'suscripcion_info'
        await connection.query(
            'INSERT INTO suscripcion_info (usuario_id, tipo_plan, estado_suscripcion, fecha_corte) VALUES (?, ?, "activa", DATE_ADD(CURDATE(), INTERVAL 1 MONTH))',
            [userId, plan || 'basico']
        );

        // 3. Si es local, insertar en 'comercio' con columnas corregidas
        if (rolFinal === 'local') {
            await connection.query(
                'INSERT INTO comercio (id_comercio, nombre_comercio, direccion_comercio, telefono_comercio, usuario_id) VALUES (?, ?, ?, ?, ?)',
                [userId, nombre, direccion || '', telefono || '', userId]
            );
        }

        await connection.commit();
        console.log(`✅ REGISTRO COMPLETO: ${nombre} (ID: ${userId} - ROL: ${rolFinal})`);
        res.status(201).json({ success: true, message: "Usuario registrado con éxito" });

    } catch (error) {
        await connection.rollback();
        console.error("❌ ERROR CRÍTICO EN SQL:", error.message);
        res.status(500).json({ success: false, message: `Error de Base de Datos: ${error.message}` });
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

// 1. Obtener los Packs (Regla: Solo si ya es la hora de activación)
app.get('/api/packs', async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT * FROM pack WHERE estado = "disponible" AND CURTIME() >= hora_activacion');
        res.json(rows);
    } catch (error) {
        console.error("❌ Error al obtener los packs:", error.message);
        res.status(500).json({ error: "Error al obtener los packs" });
    }
});

// 2. Crear una reservación (Sincronizado con Stock)
app.post('/api/reservar', async (req, res) => {
    const { usuario_id, pack_id, cantidad } = req.body;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        await connection.query(
            'INSERT INTO reservacion (usuario_id, pack_id, cantidad, fecha_reserva, estado_reserva) VALUES (?, ?, ?, NOW(), "pendiente")',
            [usuario_id, pack_id, cantidad || 1]
        );

        await connection.query(
            'UPDATE pack SET stock_disponible = stock_disponible - ? WHERE id_pack = ?',
            [cantidad || 1, pack_id]
        );

        await connection.commit();
        res.status(201).json({ success: true, message: "¡Reserva confirmada!" });

    } catch (error) {
        await connection.rollback();
        console.error("❌ ERROR AL RESERVAR:", error.message);
        res.status(500).json({ success: false, message: "Error al procesar la reserva" });
    } finally {
        connection.release();
    }
});

// 3. Validar sesión y rol (GET /me requerido)
app.get('/api/me', async (req, res) => {
    const userId = req.headers['user-id'];

    if (!userId) {
        return res.status(401).json({ success: false, message: "No autorizado" });
    }

    try {
        const [rows] = await pool.query(
            'SELECT id_usuario, nombre_usuario, email_usuario, rol_usuario FROM usuario WHERE id_usuario = ?',
            [userId]
        );

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Usuario no encontrado" });
        }

        res.json({ success: true, user: rows[0] });

    } catch (error) {
        console.error("❌ Error en GET /me:", error.message);
        res.status(500).json({ success: false, message: "Error interno" });
    }
});

// 4. Crear un nuevo Pack (Local/Admin)
app.post('/api/packs', async (req, res) => {
    const { comercio_id, nombre_pack, descripcion, precio_original, precio_descuento, stock, hora_activacion } = req.body;
    
    try {
        const query = `
            INSERT INTO pack (comercio_id, nombre_pack, descripcion, precio_original, precio_descuento, stock_disponible, hora_activacion, estado) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 'disponible')
        `;
        
        await pool.query(query, [comercio_id, nombre_pack, descripcion, precio_original, precio_descuento, stock, hora_activacion]);
        
        res.status(201).json({ success: true, message: "¡Oferta publicada exitosamente!" });
    } catch (error) {
        console.error("❌ Error al crear pack:", error.message);
        res.status(500).json({ success: false, message: "Error al guardar el pack" });
    }
});

// ==========================================
// INICIO DEL SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
    console.log(`🚀 Food-Loop ejecutándose en http://localhost:${PORT}`);
});

export default app;