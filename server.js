import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import crypto from 'crypto'; // <-- NUEVO: Para generar el folio seguro
import multer from 'multer';
import path from 'path';
import fs from 'fs';

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/'); 
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'perfil-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });
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
// RUTA DE REGISTRO (Sincronizada con tu DB y Frontend)
// ==========================================
// ==========================================
// RUTA DE REGISTRO (Sincronizada con tu DB y Frontend)
// ==========================================
// ==========================================
// RUTA DE REGISTRO (CON VALIDACIÓN DE DUPLICADOS)
// ==========================================

// ==========================================
// CONFIGURACIÓN DE MULTER (SUBIDA DE IMÁGENES)
// ==========================================
app.post('/auth/register', upload.single('foto_perfil'), async (req, res) => {
    // Al usar multer, los textos vienen en req.body y el archivo en req.file
    const { 
        nombre, nombre_usuario, email, password, plan, rol, nombre_comercio, direccion, telefono 
    } = req.body;
    
    const rolFinal = rol === 'local' ? 'local' : 'usuario';
    const nombreFinal = nombre_usuario || nombre;

    if (!nombreFinal) {
        return res.status(400).json({ success: false, message: "El nombre es obligatorio." });
    }

    const fotoUrl= req.file ? `/uploads/${req.file.filename}` : null;

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
                const folioNuevo = 'FL-' + crypto.randomBytes(3).toString('hex').toUpperCase();

            // 🛑 MODIFICAMOS EL INSERT PARA GUARDAR LA URL DE LA FOTO 🛑
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
                    'INSERT INTO comercio (nombre_comercio, direccion_comercio, telefono_comercio, usuario_id, foto_local) VALUES (?, ?, ?, ?, ?)',
                    [nombre_comercio, direccion || '', telefono || '', userId, fotoUrl] // <-- fotoUrl aquí
                );
            } else {
                const edad = req.body.edad || 18;
                await connection.query(
                    'INSERT INTO datos_usuario (usuario_id, edad, telefono, foto_usuario) VALUES (?, ?, ?, ?)',
                    [userId, edad, telefono || '', fotoUrl] // <-- fotoUrl aquí
                );
            }

                await connection.commit();
                res.status(201).json({ success: true, message: "¡Registro completado con éxito!" });
            } catch (dbError) {
                await connection.rollback();
                throw dbError; 
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

// 4. Crear un nuevo Pack (Local)
app.post('/api/packs', upload.single('foto_pack'), async (req, res) => {
    const { usuario_id, nombre_pack, descripcion, precio_original, descuento, stock } = req.body;
    
    if (!usuario_id || !nombre_pack || !precio_original || !stock) {
        return res.status(400).json({ success: false, message: "Faltan datos obligatorios." });
    }

    // Calculamos el precio final en el backend por seguridad (no confiamos en el frontend)
    const precioFinal = precio_original - (precio_original * (descuento / 100));
    const fotoUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const connection = await pool.getConnection();
    try {
        // 1. Traducimos el usuario_id al id_comercio real
        const [comercio] = await connection.query('SELECT id_comercio FROM comercio WHERE usuario_id = ?', [usuario_id]);
        
        if (comercio.length === 0) {
            return res.status(404).json({ success: false, message: "No se encontró el comercio asociado a este usuario." });
        }
        const comercioId = comercio[0].id_comercio;

        // 2. Insertamos el pack usando NOW() para la hora exacta del servidor
        const query = `
            INSERT INTO pack (comercio_id, nombre_pack, descripcion, precio_original, precio_descuento, stock_disponible, hora_activacion, estado, foto_pack) 
            VALUES (?, ?, ?, ?, ?, ?, NOW(), 'disponible', ?)
        `;
        
        await connection.query(query, [comercioId, nombre_pack, descripcion || '', precio_original, precioFinal, stock, fotoUrl]);
        
        res.status(201).json({ success: true, message: "¡Loop-Pack publicado exitosamente!" });
    } catch (error) {
        console.error("❌ Error al crear pack:", error.message);
        res.status(500).json({ success: false, message: "Error interno al guardar el pack." });
    } finally {
        connection.release();
    }
});

// 5. OBTENER EL PERFIL DEL LOCAL (Para prellenar el dashboard)
app.get('/api/comercio/me', async (req, res) => {
    // Leemos el ID que nos manda el frontend en la URL
    const { userId } = req.query; 
    
    if (!userId) {
        return res.status(400).json({ success: false, message: "Falta el ID del usuario" });
    }

    try {
        // Buscamos los datos actuales del local
        const [rows] = await pool.query(
            'SELECT direccion_comercio, hora_apertura, hora_cierre, foto_local FROM comercio WHERE usuario_id = ?', 
            [userId]
        );
        
        if (rows.length > 0) {
            // Se los mandamos al frontend para que los pinte
            res.json({ success: true, comercio: rows[0] });
        } else {
            res.status(404).json({ success: false, message: "Comercio no encontrado" });
        }
    } catch (error) {
        console.error("❌ Error al obtener el perfil del local:", error.message);
        res.status(500).json({ success: false, message: "Error interno del servidor" });
    }
});

// 6. ACTUALIZAR EL PERFIL DEL LOCAL (Dirección, horarios y reemplazar foto)
app.put('/api/comercio/actualizar', upload.single('foto_perfil'), async (req, res) => {
    const { usuario_id, direccion, apertura, cierre } = req.body;

    if (!usuario_id) {
        return res.status(400).json({ success: false, message: "ID de usuario requerido" });
    }

    const connection = await pool.getConnection();
    try {
        // Revisamos si el frontend nos mandó un archivo nuevo
        let nuevaFotoUrl = req.file ? `/uploads/${req.file.filename}` : null;

        if (nuevaFotoUrl) {
            // 🛑 LÓGICA PRO: Si hay foto nueva, buscamos la vieja y la destruimos físicamente
            const [comercioActual] = await connection.query('SELECT foto_local FROM comercio WHERE usuario_id = ?', [usuario_id]);
            
            if (comercioActual.length > 0 && comercioActual[0].foto_local) {
                const rutaFisicaVieja = path.join(process.cwd(), 'public', comercioActual[0].foto_local);
                fs.unlink(rutaFisicaVieja, (err) => {
                    if (err) console.error('⚠️ No se pudo borrar la foto vieja del servidor:', err);
                    else console.log('🗑️ Foto vieja reemplazada y destruida.');
                });
            }

            // Actualizamos la base de datos incluyendo la ruta de la nueva foto
            await connection.query(
                'UPDATE comercio SET direccion_comercio = ?, hora_apertura = ?, hora_cierre = ?, foto_local = ? WHERE usuario_id = ?',
                [direccion, apertura || null, cierre || null, nuevaFotoUrl, usuario_id]
            );
        } else {
            // Si NO subieron foto nueva, solo actualizamos los puros textos
            await connection.query(
                'UPDATE comercio SET direccion_comercio = ?, hora_apertura = ?, hora_cierre = ? WHERE usuario_id = ?',
                [direccion, apertura || null, cierre || null, usuario_id]
            );
        }

        res.json({ success: true, message: "Perfil actualizado correctamente." });
    } catch (error) {
        console.error("❌ Error al actualizar perfil:", error.message);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    } finally {
        connection.release();
    }
});

// ==========================================
// 7. OBTENER LOS PACKS DE UN LOCAL ESPECÍFICO
// ==========================================
app.get('/api/packs/comercio/:userId', async (req, res) => {
    const userId = req.params.userId;
    try {
        // 1. Traducimos el usuario_id al id_comercio
        const [comercio] = await pool.query('SELECT id_comercio FROM comercio WHERE usuario_id = ?', [userId]);
        if (comercio.length === 0) {
            return res.status(404).json({ success: false, message: "Comercio no encontrado." });
        }

        // 2. Traemos todos los packs de este comercio ordenados del más nuevo al más viejo
        const [packs] = await pool.query('SELECT * FROM pack WHERE comercio_id = ? ORDER BY id_pack DESC', [comercio[0].id_comercio]);
        
        res.json({ success: true, packs });
    } catch (error) {
        console.error("❌ Error al obtener los packs del comercio:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
});

// ==========================================
// 8. BORRAR UN LOOP-PACK (Y su foto física)
// ==========================================
app.delete('/api/packs/:packId', async (req, res) => {
    const packId = req.params.packId;
    try {
        // 1. Buscamos si el pack tiene foto para destruirla del disco duro
        const [pack] = await pool.query('SELECT foto_pack FROM pack WHERE id_pack = ?', [packId]);
        
        if (pack.length > 0 && pack[0].foto_pack) {
            const rutaFisica = path.join(process.cwd(), 'public', pack[0].foto_pack);
            fs.unlink(rutaFisica, (err) => {
                if (err) console.error('⚠️ No se pudo borrar la foto del pack físicamente:', err);
                else console.log(`🗑️ Foto del pack eliminada del servidor: ${pack[0].foto_pack}`);
            });
        }

        // 2. Lo borramos de la base de datos SQL
        await pool.query('DELETE FROM pack WHERE id_pack = ?', [packId]);
        res.json({ success: true, message: "Pack eliminado exitosamente." });
    } catch (error) {
        console.error("❌ Error al borrar el pack:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
});

// ==========================================
// RUTA PARA BORRAR USUARIO Y DESTRUIR SU FOTO FÍSICA
// ==========================================
app.delete('/api/usuarios/:id', async (req, res) => {
    const usuarioId = req.params.id;
    const connection = await pool.getConnection();

    try {
        // 1. Antes de borrar nada, averiguamos si el usuario tenía una foto guardada
        // Buscamos en ambas tablas por si acaso
        const [fotoComercio] = await connection.query('SELECT foto_local FROM comercio WHERE usuario_id = ?', [usuarioId]);
        const [fotoUsuario] = await connection.query('SELECT foto_usuario FROM datos_usuario WHERE usuario_id = ?', [usuarioId]);
        
        let rutaFoto = null;
        if (fotoComercio.length > 0 && fotoComercio[0].foto_local) rutaFoto = fotoComercio[0].foto_local;
        if (fotoUsuario.length > 0 && fotoUsuario[0].foto_usuario) rutaFoto = fotoUsuario[0].foto_usuario;

        // 2. Borramos al usuario de la base de datos (ON DELETE CASCADE se encarga del resto en SQL)
        await connection.query('DELETE FROM usuario WHERE id_usuario = ?', [usuarioId]);

        // 3. SI SQL tuvo éxito y había foto, DESTRUIMOS el archivo físico
        if (rutaFoto) {
            // Convertimos la ruta '/uploads/perfil-123.jpg' a la ruta física en el servidor 'public/uploads/perfil-123.jpg'
            const rutaFisica = path.join(process.cwd(), 'public', rutaFoto);
            
            fs.unlink(rutaFisica, (err) => {
                if (err) console.error(`⚠️ No se pudo borrar el archivo físico: ${rutaFisica}`, err);
                else console.log(`🗑️ Archivo físico destruido: ${rutaFoto}`);
            });
        }

        res.json({ success: true, message: "Usuario y archivos eliminados del sistema." });
    } catch (error) {
        console.error("Error al borrar usuario:", error);
        res.status(500).json({ success: false, message: "Error interno al intentar eliminar." });
    } finally {
        connection.release();
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