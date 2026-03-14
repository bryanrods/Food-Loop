import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import crypto from 'crypto'; // <-- NUEVO: Para generar el folio seguro
dotenv.config();

const app = express();

function generarFolio() {
    return 'FL-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}
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
// RUTA DE REGISTRO (Sincronizada con tu DB y Frontend)
// ==========================================
// ==========================================
// RUTA DE REGISTRO (Sincronizada con tu DB y Frontend)
// ==========================================
// ==========================================
// RUTA DE REGISTRO (CON VALIDACIÓN DE DUPLICADOS)
// ==========================================
app.post('/auth/register', async (req, res) => {
    const { 
        nombre, nombre_usuario, email, password, plan, rol, nombre_comercio, direccion, telefono 
    } = req.body;
    
    const rolFinal = rol === 'local' ? 'local' : 'usuario';
    const nombreFinal = nombre_usuario || nombre;

    if (!nombreFinal) {
        return res.status(400).json({ success: false, message: "El nombre es obligatorio." });
    }

    try {
        // --- 🛑 NUEVO: FILTRO ANTI-DUPLICADOS PROACTIVO 🛑 ---
        // 1. Buscamos si el correo o el nombre del usuario/dueño ya existen
        const [existeUsuario] = await pool.query(
            'SELECT email_usuario, nombre_usuario FROM usuario WHERE email_usuario = ? OR nombre_usuario = ?',
            [email, nombreFinal]
        );

        if (existeUsuario.length > 0) {
            // Identificamos exactamente qué se duplicó para decirle al frontend
            if (existeUsuario[0].email_usuario === email) {
                return res.status(409).json({ success: false, message: 'Este correo electrónico ya está registrado.' });
            }
            if (existeUsuario[0].nombre_usuario === nombreFinal) {
                return res.status(409).json({ success: false, message: 'Este nombre de usuario ya está en uso. Elige otro.' });
            }
        }

        // 2. Si es local, verificamos que el nombre de la tienda no esté repetido
        if (rolFinal === 'local') {
            const [existeLocal] = await pool.query(
                'SELECT nombre_comercio FROM comercio WHERE nombre_comercio = ?',
                [nombre_comercio]
            );
            if (existeLocal.length > 0) {
                return res.status(409).json({ success: false, message: 'Ya existe un comercio registrado con ese nombre.' });
            }
        }
        // --- FIN DEL FILTRO ---

        // Si pasó los filtros, ahora sí abrimos la conexión y guardamos
        const connection = await pool.getConnection();
        try {
            await connection.beginTransaction();

            const salt = await bcrypt.genSalt(10);
            const hashedPwd = await bcrypt.hash(password, salt);
            
            // Generamos el folio único
            const folioNuevo = 'FL-' + crypto.randomBytes(3).toString('hex').toUpperCase();

            // Insertar en 'usuario'
            const [userResult] = await connection.query(
                'INSERT INTO usuario (nombre_usuario, pswrd_usuario, email_usuario, fecha_creacion, rol_usuario, folio_usuario) VALUES (?, ?, ?, CURDATE(), ?, ?)',
                [nombreFinal, hashedPwd, email, rolFinal, folioNuevo]
            );
            const userId = userResult.insertId;

            // Insertar en 'suscripcion_info'
            await connection.query(
                'INSERT INTO suscripcion_info (usuario_id, tipo_plan, estado_suscripcion, fecha_corte) VALUES (?, ?, "activa", DATE_ADD(CURDATE(), INTERVAL 1 MONTH))',
                [userId, plan || 'basico']
            );

            // Insertar datos extra según el rol
            if (rolFinal === 'local') {
                await connection.query(
                    'INSERT INTO comercio (nombre_comercio, direccion_comercio, telefono_comercio, usuario_id) VALUES (?, ?, ?, ?)',
                    [nombre_comercio, direccion || '', telefono || '', userId]
                );
            } else {
                const edad = req.body.edad || 18; // Aseguramos que no se vaya null si olvidan mandarlo
                await connection.query(
                    'INSERT INTO datos_usuario (usuario_id, edad, telefono) VALUES (?, ?, ?)',
                    [userId, edad, telefono || '']
                );
            }

            await connection.commit();
            res.status(201).json({ success: true, message: "¡Registro completado con éxito!" });
        } catch (dbError) {
            await connection.rollback();
            throw dbError; // Lo mandamos al catch exterior
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error("❌ ERROR CRÍTICO AL REGISTRAR:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
});

// ==========================================
// RUTA DE LOGIN (Lista para SweetAlert)
// ==========================================
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const [rows] = await pool.query('SELECT * FROM usuario WHERE email_usuario = ?', [email]);
        
        if (rows.length === 0) {
            return res.status(401).json({ success: false, message: "No encontramos ninguna cuenta con este correo." });
        }

        const user = rows[0];
        const validPass = await bcrypt.compare(password, user.pswrd_usuario);

        if (!validPass) {
            return res.status(401).json({ success: false, message: "La contraseña es incorrecta." });
        }

        res.json({ 
            success: true, 
            message: `¡Bienvenido de nuevo, ${user.nombre_usuario}!`,
            user: { id: user.id_usuario, nombre: user.nombre_usuario, rol: user.rol_usuario, folio: user.folio_usuario } 
        });
    } catch (error) {
        console.error("Error en Login:", error.message);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
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
            'SELECT id_usuario, nombre_usuario, email_usuario, rol_usuario, folio_usuario FROM usuario WHERE id_usuario = ?',
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