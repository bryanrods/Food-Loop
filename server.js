import express from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';

import { BlobServiceClient } from '@azure/storage-blob';

dotenv.config();
console.log("DEBUG: ¿Conexión encontrada?", process.env.AZURE_STORAGE_CONNECTION_STRING ? "SÍ" : "NO");
const app = express();

// 1. Cambiamos Multer a Memoria (Ya no escribimos en disco)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
    
// 2. Configurar Azure
const AZURE_CONNECTION = process.env.AZURE_STORAGE_CONNECTION_STRING;
const blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_CONNECTION);
const containerClient = blobServiceClient.getContainerClient('fotos-foodloop'); // El nombre que pusiste en Azure

// 3. Función Maestra para subir fotos
async function subirFotoAzure(file) {
    if (!file) return null;
    const blobName = `img-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    const blockBlobClient = containerClient.getBlockBlobClient(blobName);
    
    await blockBlobClient.uploadData(file.buffer, {
        blobHTTPHeaders: { blobContentType: file.mimetype }
    });
    
    return blockBlobClient.url; // Esta es la URL completa: https://...
}

// const storage = multer.diskStorage({
//     destination: function (req, file, cb) {
//         cb(null, 'public/uploads/'); 
//     },
//     filename: function (req, file, cb) {
//         const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//         cb(null, 'perfil-' + uniqueSuffix + path.extname(file.originalname));
//     }
// });

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

        const fotoUrl = req.file ? await subirFotoAzure(req.file) : null;
    try {
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
            
            // 🛑 1. Insertamos en usuario SIN EL FOLIO (ya no existe esa columna aquí)
            const [userResult] = await connection.query(
                'INSERT INTO usuario (nombre_usuario, pswrd_usuario, email_usuario, fecha_creacion, rol_usuario) VALUES (?, ?, ?, CURDATE(), ?)',
                [nombreFinal, hashedPwd, email, rolFinal]
            );
            const userId = userResult.insertId;

            // 🛑 2. SEPARAMOS LA LÓGICA POR ROL
            if (rolFinal === 'local') {
                // Si es local, SOLO guardamos en la tabla comercio. (No generamos folio ni suscripción)
                await connection.query(
                    'INSERT INTO comercio (nombre_comercio, direccion_comercio, telefono_comercio, usuario_id, foto_local) VALUES (?, ?, ?, ?, ?)',
                    [nombre_comercio, direccion || '', telefono || '', userId, fotoUrl]
                );
            } else {
                // Si es usuario regular, SÍ generamos folio y SÍ le creamos su membresía
                const folioNuevo = 'FL-' + crypto.randomBytes(3).toString('hex').toUpperCase();
                
                // Primero inactivo y con fecha de corte en NULL porque aún no paga
                await connection.query(
                    'INSERT INTO suscripcion_info (usuario_id, tipo_plan, estado_suscripcion, fecha_corte, folio_suscripcion) VALUES (?, ?, "inactiva", NULL, ?)',
                    [userId, plan || 'basico', folioNuevo]
                );

                // Insertamos sus datos extra
                const edad = req.body.edad || 18; 
                await connection.query(
                    'INSERT INTO datos_usuario (usuario_id, edad, telefono, foto_usuario) VALUES (?, ?, ?, ?)',
                    [userId, edad, telefono || '', fotoUrl]
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
// RUTA DE LOGIN (Actualizada para leer el folio mudado)
// ==========================================
app.post('/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // LEFT JOIN es clave: Deja entrar a los locales (que no tienen suscripción) 
        // y a los usuarios (trayendo su folio de la otra tabla)
        const query = `
            SELECT u.*, s.folio_suscripcion 
            FROM usuario u 
            LEFT JOIN suscripcion_info s ON u.id_usuario = s.usuario_id 
            WHERE u.email_usuario = ? AND u.activo = TRUE
        `;
        const [rows] = await pool.query(query, [email]);
        
        if (rows.length === 0) {
            // Si el usuario existe pero activo = 0, caerá aquí.
            return res.status(401).json({ success: false, message: "Cuenta inexistente o desactivada." });
        }

        const user = rows[0];
        const validPass = await bcrypt.compare(password, user.pswrd_usuario);

        if (!validPass) {
            return res.status(401).json({ success: false, message: "La contraseña es incorrecta." });
        }

        res.json({ 
            success: true, 
            message: `¡Bienvenido de nuevo, ${user.nombre_usuario}!`,
            user: { 
                id: user.id_usuario, 
                nombre: user.nombre_usuario, 
                rol: user.rol_usuario, 
                // Mandamos el folio correcto, y si es un local, mandamos null para no causar errores
                folio: user.folio_suscripcion || null 
            } 
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
        // 🛑 EL FILTRO: Solo disponible, en hora, y con stock > 0
            const query = `
                SELECT p.*, c.nombre_comercio 
                FROM pack p
                JOIN comercio c ON p.comercio_id = c.id_comercio
                WHERE p.estado = "disponible" 
                AND c.estado_operativo = "abierto"
                AND p.stock_disponible > 0
            `;        
            const [rows] = await pool.query(query);
        res.json(rows);
    } catch (error) {
        console.error("❌ Error al obtener los packs:", error.message);
        res.status(500).json({ error: "Error al obtener los packs" });
    }
});
// 2. Validar sesión y rol (GET /me requerido)
app.get('/api/me', async (req, res) => {
    const userId = req.headers['user-id'];

    if (!userId) {
        return res.status(401).json({ success: false, message: "No autorizado" });
    }

    try {
        // Usamos LEFT JOIN para no bloquear a los locales, y usamos AS para engañar al frontend
        // haciéndole creer que la columna se sigue llamando folio_usuario
        const query = `
            SELECT u.id_usuario, u.nombre_usuario, u.email_usuario, u.rol_usuario, 
                   s.folio_suscripcion AS folio_usuario, 
                   s.estado_suscripcion, 
                   s.fecha_corte,
                   d.telefono, d.foto_usuario
            FROM usuario u 
            LEFT JOIN suscripcion_info s ON u.id_usuario = s.usuario_id 
            LEFT JOIN datos_usuario d ON u.id_usuario = d.usuario_id
            WHERE u.id_usuario = ?
        `;
        const [rows] = await pool.query(query, [userId]);

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
    const fotoUrl = req.file ? await subirFotoAzure(req.file) : null;
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
            // 🛑 IMPORTANTE: Asegúrate de que esta columna esté en el SELECT
            'SELECT direccion_comercio, telefono_comercio, hora_apertura, hora_cierre, foto_local, estado_operativo FROM comercio WHERE usuario_id = ?', 
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
    const { usuario_id, direccion, apertura, cierre, telefono } = req.body;
    const connection = await pool.getConnection();
    try {
        const nuevaFotoUrl = req.file ? await subirFotoAzure(req.file) : null;
        if (nuevaFotoUrl) {
            await connection.query(
                'UPDATE comercio SET direccion_comercio = ?, telefono_comercio = ?, hora_apertura = ?, hora_cierre = ?, foto_local = ? WHERE usuario_id = ?',
                [direccion, telefono, apertura || null, cierre || null, nuevaFotoUrl, usuario_id]
            );
        } else {
            await connection.query(
                'UPDATE comercio SET direccion_comercio = ?, telefono_comercio = ?, hora_apertura = ?, hora_cierre = ? WHERE usuario_id = ?',
                [direccion, telefono, apertura || null, cierre || null, usuario_id]
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

app.put('/api/comercio/estado', async (req, res) => {
    const { usuario_id, nuevo_estado } = req.body; // nuevo_estado: 'abierto' o 'cerrado'

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Obtener id_comercio
        const [comercio] = await connection.query('SELECT id_comercio FROM comercio WHERE usuario_id = ?', [usuario_id]);
        if (comercio.length === 0) return res.status(404).json({ success: false, message: "Local no encontrado." });
        
        const idComercio = comercio[0].id_comercio;

        // 2. Si quiere CERRAR, verificamos pendientes
        if (nuevo_estado === 'cerrado') {
            const [pendientes] = await connection.query(`
                SELECT COUNT(*) AS total 
                FROM reservacion r
                JOIN pack p ON r.pack_id = p.id_pack
                WHERE p.comercio_id = ? AND r.estado_reserva = 'pendiente'
            `, [idComercio]);

            if (pendientes[0].total > 0) {
                await connection.rollback();
                return res.status(400).json({ 
                    success: false, 
                    message: `No puedes cerrar. Tienes ${pendientes[0].total} entregas pendientes.` 
                });
            }
        }

        // 3. Cambiar estado y ocultar packs automáticamente si cierra
        await connection.query('UPDATE comercio SET estado_operativo = ? WHERE id_comercio = ?', [nuevo_estado, idComercio]);
        
        if (nuevo_estado === 'cerrado') {
            await connection.query('UPDATE pack SET estado = "oculto" WHERE comercio_id = ?', [idComercio]);
        }

        await connection.commit();
        res.json({ success: true, message: `El local ahora está ${nuevo_estado.toUpperCase()}.` });

    } catch (error) {
        await connection.rollback();
        res.status(500).json({ success: false, message: "Error al cambiar estado." });
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
        const [comercio] = await pool.query('SELECT id_comercio FROM comercio WHERE usuario_id = ?', [userId]);
        if (comercio.length === 0) {
            return res.status(404).json({ success: false, message: "Comercio no encontrado." });
        }

        const query = 'SELECT * FROM pack WHERE comercio_id = ? AND stock_disponible > 0 ORDER BY id_pack DESC';
        const [packs] = await pool.query(query, [comercio[0].id_comercio]);
        
        res.json({ success: true, packs });
    } catch (error) {
        console.error("❌ Error al obtener los packs del comercio:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
});

// ==========================================
// 8. "BORRAR" UN LOOP-PACK (Baja Lógica)
// ==========================================
app.delete('/api/packs/:packId', async (req, res) => {
    const packId = req.params.packId;
    try {
        const query = 'UPDATE pack SET estado = "eliminado", stock_disponible = 0 WHERE id_pack = ?';
        await pool.query(query, [packId]);
        
        res.json({ success: true, message: "El pack ha sido retirado de la venta." });
    } catch (error) {
        console.error("❌ Error al retirar el pack:", error);
        res.status(500).json({ success: false, message: "Error al procesar la solicitud." });
    }
});

// ==========================================
// 9. EDITAR UN LOOP-PACK (Con o sin foto nueva)
// ==========================================
app.put('/api/packs/:packId', upload.single('foto_pack'), async (req, res) => {
    const packId = req.params.packId;
    const { nombre_pack, descripcion, precio_original, descuento, stock } = req.body;
    const precioFinal = precio_original - (precio_original * (descuento / 100));

    try {
        const nuevaFotoUrl = req.file ? await subirFotoAzure(req.file) : null;

        if (nuevaFotoUrl) {
            await pool.query(
                'UPDATE pack SET nombre_pack = ?, descripcion = ?, precio_original = ?, precio_descuento = ?, stock_disponible = ?, foto_pack = ? WHERE id_pack = ?',
                [nombre_pack, descripcion, precio_original, precioFinal, stock, nuevaFotoUrl, packId]
            );
        } else {
            await pool.query(
                'UPDATE pack SET nombre_pack = ?, descripcion = ?, precio_original = ?, precio_descuento = ?, stock_disponible = ? WHERE id_pack = ?',
                [nombre_pack, descripcion, precio_original, precioFinal, stock, packId]
            );
        }
        res.json({ success: true, message: "¡Loop-Pack actualizado!" });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// ==========================================
// 10. CONSULTAR FOLIO DE USUARIO ANTES DE COBRAR
// ==========================================
app.get('/api/suscripcion/consultar/:folio', async (req, res) => {
    const folio = req.params.folio;
    try {
        // Ahora buscamos el 'folio_suscripcion' dentro de la tabla 's' (suscripcion_info)
        const query = `
            SELECT u.id_usuario, u.nombre_usuario, s.tipo_plan, s.estado_suscripcion, s.fecha_corte 
            FROM usuario u
            JOIN suscripcion_info s ON u.id_usuario = s.usuario_id
            WHERE s.folio_suscripcion = ? AND u.rol_usuario = 'usuario'
        `;
        const [rows] = await pool.query(query, [folio]);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, message: "Folio no encontrado o no pertenece a un cliente." });
        }

        const datos = rows[0];
        // Definir precios según el plan (Ajusta estos precios a tu modelo de negocio)
        const costo = datos.tipo_plan === 'premium' ? 75 : 45;

        res.json({ success: true, usuario: datos, costo: costo });
    } catch (error) {
        console.error("❌ Error al consultar folio:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
});

// ==========================================
// 11. ACTIVAR O RENOVAR SUSCRIPCIÓN (Registrando el pago real)
// ==========================================
app.put('/api/suscripcion/renovar', async (req, res) => {
    
    // 🛑 AHORA: Recibimos el ID del cliente, el ID del dueño del local, y el dinero
    const { usuario_id, local_usuario_id, monto } = req.body; 
    
    if (!usuario_id || !local_usuario_id || !monto) {
        return res.status(400).json({ success: false, message: "Faltan datos financieros para procesar la activación." });
    }

    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 🛑 LA TRADUCCIÓN OBLIGATORIA: Buscamos el ID real del comercio
        const [comercio] = await connection.query(
            'SELECT id_comercio FROM comercio WHERE usuario_id = ?', 
            [local_usuario_id]
        );

        if (comercio.length === 0) {
            throw new Error("Local no autorizado. No se encontró su comercio en la base de datos.");
        }
        const comercio_id_real = comercio[0].id_comercio;

        // 1. Buscamos el id_suscripcion que le pertenece a este usuario (el cliente)
        const [subInfo] = await connection.query(
            'SELECT id_suscripcion FROM suscripcion_info WHERE usuario_id = ?', 
            [usuario_id]
        );

        if (subInfo.length === 0) {
            throw new Error("No se encontró la membresía de este usuario.");
        }
        const idSuscripcion = subInfo[0].id_suscripcion;

        // 2. Actualizamos el estado a activa
        await connection.query(`
            UPDATE suscripcion_info 
            SET estado_suscripcion = 'activa', fecha_corte = DATE_ADD(CURDATE(), INTERVAL 1 MONTH) 
            WHERE usuario_id = ?
        `, [usuario_id]);
        
        // 3. 💰 REGISTRAMOS EL DINERO USANDO EL COMERCIO_ID TRADUCIDO
        const refPago = 'PAGO-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        
        await connection.query(`
            INSERT INTO suscripcion_pago (suscripcion_id, monto_pago, dia_cobro, estado_pago, referencia_pago, comercio_id) 
            VALUES (?, ?, CURDATE(), 'completado', ?, ?)
        `, [idSuscripcion, monto, refPago, comercio_id_real]); // Usamos la variable segura

        await connection.commit();
        res.json({ success: true, message: "¡Suscripción activada y pago registrado en caja!" });
    } catch (error) {
        await connection.rollback();
        console.error("❌ Error al renovar suscripción:", error);
        res.status(500).json({ success: false, message: error.message || "Error interno al guardar el pago." });
    } finally {
        connection.release();
    }
});

// ==========================================
// 12. ACTUALIZAR PERFIL DE USUARIO NORMAL
// ==========================================
app.put('/api/usuarios/actualizar', upload.single('foto_perfil'), async (req, res) => {
    const { usuario_id, telefono } = req.body;
    try {
        const nuevaFotoUrl = req.file ? await subirFotoAzure(req.file) : null;

        if (nuevaFotoUrl) {
            await pool.query('UPDATE datos_usuario SET telefono = ?, foto_usuario = ? WHERE usuario_id = ?', [telefono, nuevaFotoUrl, usuario_id]);
        } else {
            await pool.query('UPDATE datos_usuario SET telefono = ? WHERE usuario_id = ?', [telefono, usuario_id]);
        }
        res.json({ success: true, message: "Perfil de usuario actualizado." });
    } catch (error) {
        res.status(500).json({ success: false });
    }
});

// ==========================================
// BORRADO LÓGICO DE LOCAL (No destruye, solo oculta)
// ==========================================
app.delete('/api/usuarios/:id', async (req, res) => {
    const usuarioId = req.params.id;
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        // 1. Verificamos si es un local
        const [user] = await connection.query('SELECT rol_usuario FROM usuario WHERE id_usuario = ?', [usuarioId]);
        
        if (user.length > 0 && user[0].rol_usuario === 'local') {
            // 🛑 EN LUGAR DE DELETE: Marcamos como inactivo
            // Y de paso, "apagamos" todos sus packs para que desaparezcan de la app
            await connection.query('UPDATE usuario SET activo = FALSE WHERE id_usuario = ?', [usuarioId]);
            
            const [comercio] = await connection.query('SELECT id_comercio FROM comercio WHERE usuario_id = ?', [usuarioId]);
            if (comercio.length > 0) {
                await connection.query('UPDATE pack SET estado = "oculto", stock_disponible = 0 WHERE comercio_id = ?', [comercio[0].id_comercio]);
            }
        } else {
            // Si es un usuario normal sin compras, aquí sí podrías decidir si borrar o no
            await connection.query('DELETE FROM usuario WHERE id_usuario = ?', [usuarioId]);
        }

        await connection.commit();
        res.json({ success: true, message: "Cuenta desactivada y packs retirados." });
    } catch (error) {
        await connection.rollback();
        console.error("Error al dar de baja:", error);
        res.status(500).json({ success: false, message: "No se puede borrar por integridad de datos." });
    } finally {
        connection.release();
    }
});

// OBTENER HISTORIAL DE COMPRAS/APARTADOS
app.get('/api/reservaciones/usuario/:id', async (req, res) => {
    try {
        const query = `
            SELECT 
                r.id_reservacion AS id_reserva, 
                r.cantidad, 
                r.estado_reserva, 
                DATE_FORMAT(r.fecha_reserva, '%d/%m/%Y %H:%i') AS fecha_formateada,
                r.fecha_reserva,
                TIMESTAMPDIFF(SECOND, NOW(), r.fecha_reserva + INTERVAL 1 HOUR) AS segundos_restantes,
                p.nombre_pack, 
                p.precio_descuento, 
                p.foto_pack, 
                c.nombre_comercio, 
                c.direccion_comercio,
                c.telefono_comercio
            FROM reservacion r
            JOIN pack p ON r.pack_id = p.id_pack
            JOIN comercio c ON p.comercio_id = c.id_comercio
            WHERE r.usuario_id = ?
            ORDER BY r.id_reservacion DESC
        `;
        const [rows] = await pool.query(query, [req.params.id]);
        res.json({ success: true, reservaciones: rows });
    } catch (error) {
        console.error("Error obteniendo compras:", error);
        res.status(500).json({ success: false, message: "Error interno." });
    }
});

// A. CREAR RESERVA
app.post('/api/reservar', async (req, res) => {
    const { usuario_id, pack_id, cantidad } = req.body;
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();
        
        // Revisamos stock real en la BD
        const [pack] = await connection.query('SELECT stock_disponible FROM pack WHERE id_pack = ? FOR UPDATE', [pack_id]);
        if (pack.length === 0 || pack[0].stock_disponible < cantidad) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "Stock insuficiente." });
        }

        // Insertamos reserva
        await connection.query(
            'INSERT INTO reservacion (usuario_id, pack_id, cantidad, fecha_reserva, estado_reserva) VALUES (?, ?, ?, NOW(), "pendiente")',
            [usuario_id, pack_id, cantidad]
        );

        // Descontamos inventario
        await connection.query('UPDATE pack SET stock_disponible = stock_disponible - ? WHERE id_pack = ?', [cantidad, pack_id]);

        await connection.commit();
        res.json({ success: true, message: "Apartado confirmado." });
    } catch (error) {
        await connection.rollback();
        console.error("Error en reserva:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    } finally {
        connection.release();
    }
});

// ==========================================
// C. OBTENER APARTADOS PARA EL LOCAL (Solo los de HOY)
// ==========================================
app.get('/api/reservaciones/comercio/:userId', async (req, res) => {
    try {
        const [comercio] = await pool.query('SELECT id_comercio FROM comercio WHERE usuario_id = ?', [req.params.userId]);
        if (comercio.length === 0) return res.status(404).json({ success: false, message: "Comercio no encontrado" });

        const query = `
            SELECT r.id_reservacion AS id_reserva, r.cantidad, r.estado_reserva, DATE_FORMAT(r.fecha_reserva, '%h:%i %p') AS hora,
                   TIMESTAMPDIFF(SECOND, NOW(), r.fecha_reserva + INTERVAL 1 HOUR) AS segundos_restantes,
                   p.nombre_pack, p.precio_descuento, p.foto_pack, 
                   u.nombre_usuario, -- Traemos el nombre real del cliente
                   c.nombre_comercio, c.direccion_comercio
            FROM reservacion r
            JOIN pack p ON r.pack_id = p.id_pack
            JOIN comercio c ON p.comercio_id = c.id_comercio
            JOIN usuario u ON r.usuario_id = u.id_usuario -- Conectamos con el cliente
            WHERE p.comercio_id = ? -- CORRECCIÓN: Filtramos por el ID de la tienda, no del usuario
            ORDER BY r.id_reservacion DESC
        `;
        const [rows] = await pool.query(query, [comercio[0].id_comercio]);
        
        // Ahora sí devolvemos 'reservaciones' para que haga match perfecto con tu frontend
        res.json({ success: true, reservaciones: rows });
    } catch (error) {
        console.error("❌ Error al obtener apartados:", error);
        res.status(500).json({ success: false, message: "Error interno." });
    }
});

// ==========================================
// D. COBRAR RESERVA (Con registro financiero blindado)
// ==========================================
app.put('/api/reservaciones/cobrar/:id', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Buscamos los datos reales para no confiar en el frontend
        const [reserva] = await connection.query(`
            SELECT r.cantidad, p.precio_descuento, p.comercio_id, p.nombre_pack, u.nombre_usuario
            FROM reservacion r
            JOIN pack p ON r.pack_id = p.id_pack
            JOIN usuario u ON r.usuario_id = u.id_usuario
            WHERE r.id_reservacion = ? AND r.estado_reserva = 'pendiente'
        `, [req.params.id]);

        if (reserva.length === 0) {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "La reserva no existe o ya fue procesada." });
        }

        const montoTotal = reserva[0].cantidad * reserva[0].precio_descuento;
        const motivo = `Venta en local: ${reserva[0].nombre_pack} (Cliente: ${reserva[0].nombre_usuario})`;

        // 2. Cambiamos estado de reserva
        await connection.query('UPDATE reservacion SET estado_reserva = "completada" WHERE id_reservacion = ?', [req.params.id]);

        // 3. Insertamos la ganancia real
        await connection.query(
            'INSERT INTO ganancias_local (comercio_id, reservacion_id, monto, motivo_pago) VALUES (?, ?, ?, ?)',
            [reserva[0].comercio_id, req.params.id, montoTotal, motivo]
        );

        await connection.commit();
        res.json({ success: true, message: "¡Cobro registrado y ganancia guardada!" });
    } catch (error) {
        await connection.rollback();
        console.error("❌ Error al cobrar:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    } finally {
        connection.release();
    }
});

// ==========================================
// E. OBTENER GANANCIAS DETALLADAS DEL LOCAL (Packs + Suscripciones)
// ==========================================
app.get('/api/ganancias/comercio/:userId', async (req, res) => {
    try {
        const [comercio] = await pool.query('SELECT id_comercio FROM comercio WHERE usuario_id = ?', [req.params.userId]);
        if (comercio.length === 0) return res.status(404).json({ success: false });

        const comercioId = comercio[0].id_comercio;

        // Unificamos ventas de packs y cobros de folios
        const query = `
            SELECT 
                fecha, 
                motivo, 
                monto_total, 
                comision_foodloop,
                (monto_total - comision_foodloop) AS mi_ganancia
            FROM (
                -- 1. Ventas de Packs (5% de comisión)
                SELECT 
                    fecha, 
                    motivo_pago AS motivo, 
                    monto AS monto_total, 
                    (monto * 0.05) AS comision_foodloop
                FROM ganancias_local 
                WHERE comercio_id = ?

                UNION ALL

                -- 2. Cobros de Suscripciones (100% de comisión/deuda)
                SELECT 
                    dia_cobro AS fecha, 
                    'Recaudación de Membresía' AS motivo, 
                    monto_pago AS monto_total, 
                    monto_pago AS comision_foodloop
                FROM suscripcion_pago
                WHERE comercio_id = ? AND estado_pago = 'completado'
            ) AS transacciones
            ORDER BY fecha DESC
        `;

        const [ganancias] = await pool.query(query, [comercioId, comercioId]);

        res.json({ success: true, ganancias });
    } catch (error) {
        console.error("Error al obtener historial unificado:", error);
        res.status(500).json({ success: false });
    }
});

// ==========================================
// F. CANCELAR APARTADO (Y devolver stock al local)
// ==========================================
app.put('/api/reservaciones/cancelar/:id', async (req, res) => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Buscamos la reserva para saber cuánto stock debemos devolver
        const [reserva] = await connection.query(
            'SELECT pack_id, cantidad, estado_reserva FROM reservacion WHERE id_reservacion = ?', 
            [req.params.id]
        );

        // Validaciones de seguridad
        if (reserva.length === 0) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: "La reserva no existe." });
        }
        if (reserva[0].estado_reserva !== 'pendiente') {
            await connection.rollback();
            return res.status(400).json({ success: false, message: "Solo puedes cancelar pedidos pendientes." });
        }

        // 2. Cambiamos el estado de la reserva
        await connection.query(
            'UPDATE reservacion SET estado_reserva = "cancelada" WHERE id_reservacion = ?', 
            [req.params.id]
        );

        // 3. ¡LA MAGIA! Le devolvemos el stock al local
        await connection.query(
            'UPDATE pack SET stock_disponible = stock_disponible + ? WHERE id_pack = ?', 
            [reserva[0].cantidad, reserva[0].pack_id]
        );

        await connection.commit();
        res.json({ success: true, message: "Apartado cancelado y stock devuelto." });
    } catch (error) {
        await connection.rollback();
        console.error("❌ Error al cancelar reserva:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    } finally {
        connection.release();
    }
});

// ==========================================
// TAREA AUTOMÁTICA (CRON): CANCELAR APARTADOS VENCIDOS (1 HORA)
// ==========================================
setInterval(async () => {
    const connection = await pool.getConnection();
    try {
        await connection.beginTransaction();

        // Buscamos todas las reservas pendientes que se hicieron hace más de 1 hora
        const query = `
            SELECT id_reservacion, pack_id, cantidad 
            FROM reservacion 
            WHERE estado_reserva = 'pendiente' 
            AND fecha_reserva <= NOW() - INTERVAL 1 HOUR
        `;
        const [expiradas] = await connection.query(query);

        if (expiradas.length > 0) {
            for (let reserva of expiradas) {
                // 1. Cancelamos la reserva
                await connection.query('UPDATE reservacion SET estado_reserva = "cancelada" WHERE id_reservacion = ?', [reserva.id_reservacion]);
                // 2. Le devolvemos el stock al local
                await connection.query('UPDATE pack SET stock_disponible = stock_disponible + ? WHERE id_pack = ?', [reserva.cantidad, reserva.pack_id]);
            }
            console.log(`🧹 Barredor automático: Se cancelaron ${expiradas.length} reservas vencidas y se devolvió el stock.`);
        }

        await connection.commit();
    } catch (error) {
        await connection.rollback();
        console.error("❌ Error en el barredor automático de reservas:", error);
    } finally {
        connection.release();
    }
}, 60000); // Se ejecuta cada 60,000 milisegundos (1 minuto)

// ==========================================
// RUTAS DE ADMINISTRADOR
// ==========================================
// A. Ver las finanzas y deudas de cada local (DATOS REALES Y COMBINADOS)
app.get('/api/admin/finanzas', async (req, res) => {
    try {
        const query = `
            SELECT 
                c.id_comercio,
                -- 🛑 SI EL USUARIO ESTÁ INACTIVO, AÑADIMOS LA ETIQUETA AL NOMBRE
                IF(u.activo, c.nombre_comercio, CONCAT(c.nombre_comercio, ' (BAJA)')) AS nombre_comercio,
                COALESCE(ventas.comision, 0) AS comision_packs,
                COALESCE(subs.total_subs, 0) AS total_membresias,
                COALESCE(ventas.comision, 0) + COALESCE(subs.total_subs, 0) AS deuda_foodloop
            FROM comercio c
            JOIN usuario u ON c.usuario_id = u.id_usuario -- Unimos con usuario para ver su estado
            LEFT JOIN (
                SELECT p.comercio_id, SUM(r.cantidad * p.precio_descuento * 0.05) as comision
                FROM reservacion r
                JOIN pack p ON r.pack_id = p.id_pack
                WHERE r.estado_reserva = 'completada'
                GROUP BY p.comercio_id
            ) ventas ON c.id_comercio = ventas.comercio_id
            LEFT JOIN (
                SELECT comercio_id, SUM(monto_pago) as total_subs
                FROM suscripcion_pago
                WHERE estado_pago = 'completado'
                GROUP BY comercio_id
            ) subs ON c.id_comercio = subs.comercio_id
            ORDER BY deuda_foodloop DESC
        `;
        const [rows] = await pool.query(query);
        res.json({ success: true, finanzas: rows });
    } catch (error) {
        console.error("Error en finanzas admin:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
});

// C. Ver desglose detallado (Usando UNION para unificar ventas y membresías)
app.get('/api/admin/finanzas/:comercioId', async (req, res) => {
    try {
        const query = `
            SELECT 
                r.fecha_reserva AS fecha,
                CONCAT('Venta Pack: ', p.nombre_pack, ' (x', r.cantidad, ')') AS motivo, 
                (r.cantidad * p.precio_descuento) AS monto_original,
                (r.cantidad * p.precio_descuento * 0.05) AS ganancia_foodloop
            FROM reservacion r
            JOIN pack p ON r.pack_id = p.id_pack
            WHERE p.comercio_id = ? AND r.estado_reserva = 'completada'
            
            UNION ALL
            
            SELECT 
                dia_cobro AS fecha,
                'Suscripción de Usuario' AS motivo,
                monto_pago AS monto_original,
                monto_pago AS ganancia_foodloop
            FROM suscripcion_pago
            WHERE comercio_id = ? AND estado_pago = 'completado'
            
            ORDER BY fecha DESC
        `;
        const [rows] = await pool.query(query, [req.params.comercioId, req.params.comercioId]);
        res.json({ success: true, detalles: rows });
    } catch (error) {
        console.error("Error obteniendo detalles financieros:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
});

app.get('/api/admin/usuarios', async (req, res) => {
    try {
        const query = `
            SELECT id_usuario, nombre_usuario, email_usuario, rol_usuario, DATE_FORMAT(fecha_creacion, '%d/%m/%Y') AS fecha
            FROM usuario
            WHERE rol_usuario != 'admin' AND activo = TRUE -- 🛑 SOLO LOS QUE SIGUEN ACTIVOS
            ORDER BY id_usuario DESC
        `;
        const [usuarios] = await pool.query(query);
        res.json({ success: true, usuarios });
    } catch (error) {
        console.error("Error obteniendo usuarios:", error);
        res.status(500).json({ success: false, message: "Error interno." });
    }
});

// ==========================================
// RUTAS DE REACTIVACIÓN (ADMIN)
// ==========================================

// A. Obtener solo usuarios inactivos
app.get('/api/admin/usuarios/inactivos', async (req, res) => {
    try {
        const query = `
            SELECT id_usuario, nombre_usuario, email_usuario, rol_usuario, DATE_FORMAT(fecha_creacion, '%d/%m/%Y') AS fecha
            FROM usuario
            WHERE activo = FALSE AND rol_usuario != 'admin'
            ORDER BY id_usuario DESC
        `;
        const [usuarios] = await pool.query(query);
        res.json({ success: true, usuarios });
    } catch (error) {
        console.error("Error obteniendo inactivos:", error);
        res.status(500).json({ success: false, message: "Error al obtener la lista de bajas." });
    }
});

// B. Reactivar una cuenta
app.put('/api/admin/usuarios/reactivar/:id', async (req, res) => {
    const usuarioId = req.params.id;
    try {
        // Simplemente encendemos el interruptor de nuevo
        await pool.query('UPDATE usuario SET activo = TRUE WHERE id_usuario = ?', [usuarioId]);
        
        res.json({ success: true, message: "La cuenta ha sido reactivada. El usuario ya puede iniciar sesión." });
    } catch (error) {
        console.error("Error al reactivar usuario:", error);
        res.status(500).json({ success: false, message: "No se pudo reactivar la cuenta." });
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