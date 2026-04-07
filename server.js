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
            WHERE u.email_usuario = ?
        `;
        const [rows] = await pool.query(query, [email]);
        
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
        const query = 'SELECT * FROM pack WHERE estado = "disponible" AND CURTIME() >= hora_activacion AND stock_disponible > 0';
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
// 9. EDITAR UN LOOP-PACK (Con o sin foto nueva)
// ==========================================
app.put('/api/packs/:packId', upload.single('foto_pack'), async (req, res) => {
    const packId = req.params.packId;
    const { nombre_pack, descripcion, precio_original, descuento, stock } = req.body;
    
    // Calculamos el nuevo precio final por seguridad
    const precioFinal = precio_original - (precio_original * (descuento / 100));

    const connection = await pool.getConnection();
    try {
        let nuevaFotoUrl = req.file ? `/uploads/${req.file.filename}` : null;

        if (nuevaFotoUrl) {
            // 🛑 Si mandaron foto nueva, buscamos la vieja para destruirla
            const [packViejo] = await connection.query('SELECT foto_pack FROM pack WHERE id_pack = ?', [packId]);
            
            if (packViejo.length > 0 && packViejo[0].foto_pack) {
                const rutaFisica = path.join(process.cwd(), 'public', packViejo[0].foto_pack);
                fs.unlink(rutaFisica, (err) => { if(err) console.error("Error borrando foto vieja del pack"); });
            }

            // Actualizamos todo, incluyendo la nueva ruta de la foto
            await connection.query(
                'UPDATE pack SET nombre_pack = ?, descripcion = ?, precio_original = ?, precio_descuento = ?, stock_disponible = ?, foto_pack = ? WHERE id_pack = ?',
                [nombre_pack, descripcion, precio_original, precioFinal, stock, nuevaFotoUrl, packId]
            );
        } else {
            // Actualizamos solo los textos, dejando la foto que ya tenía
            await connection.query(
                'UPDATE pack SET nombre_pack = ?, descripcion = ?, precio_original = ?, precio_descuento = ?, stock_disponible = ? WHERE id_pack = ?',
                [nombre_pack, descripcion, precio_original, precioFinal, stock, packId]
            );
        }

        res.json({ success: true, message: "¡Loop-Pack actualizado exitosamente!" });
    } catch (error) {
        console.error("❌ Error al editar pack:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    } finally {
        connection.release();
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
// 11. ACTIVAR O RENOVAR SUSCRIPCIÓN (El folio NO cambia)
// ==========================================
app.put('/api/suscripcion/renovar', async (req, res) => {
    const { usuario_id } = req.body;
    if (!usuario_id) return res.status(400).json({ success: false, message: "ID de usuario requerido." });

    try {
        // Actualizamos el estado a activo y le sumamos 1 mes a la fecha actual
        const query = `
            UPDATE suscripcion_info 
            SET estado_suscripcion = 'activa', fecha_corte = DATE_ADD(CURDATE(), INTERVAL 1 MONTH) 
            WHERE usuario_id = ?
        `;
        await pool.query(query, [usuario_id]);
        
        res.json({ success: true, message: "¡Suscripción actualizada y activa por 1 mes!" });
    } catch (error) {
        console.error("❌ Error al renovar suscripción:", error);
        res.status(500).json({ success: false, message: "Error interno del servidor." });
    }
});

// ==========================================
// 12. ACTUALIZAR PERFIL DE USUARIO NORMAL
// ==========================================
app.put('/api/usuarios/actualizar', upload.single('foto_perfil'), async (req, res) => {
    const { usuario_id, telefono } = req.body;
    if (!usuario_id) return res.status(400).json({ success: false, message: "ID requerido" });

    const connection = await pool.getConnection();
    try {
        let nuevaFotoUrl = req.file ? `/uploads/${req.file.filename}` : null;

        if (nuevaFotoUrl) {
            // Buscamos y destruimos la foto vieja
            const [viejo] = await connection.query('SELECT foto_usuario FROM datos_usuario WHERE usuario_id = ?', [usuario_id]);
            if (viejo.length > 0 && viejo[0].foto_usuario) {
                const rutaFisica = path.join(process.cwd(), 'public', viejo[0].foto_usuario);
                fs.unlink(rutaFisica, () => {});
            }
            // Actualizamos teléfono y foto
            await connection.query('UPDATE datos_usuario SET telefono = ?, foto_usuario = ? WHERE usuario_id = ?', [telefono, nuevaFotoUrl, usuario_id]);
        } else {
            // Actualizamos solo el teléfono
            await connection.query('UPDATE datos_usuario SET telefono = ? WHERE usuario_id = ?', [telefono, usuario_id]);
        }

        res.json({ success: true, message: "Perfil actualizado con éxito." });
    } catch (error) {
        console.error("❌ Error al actualizar usuario:", error);
        res.status(500).json({ success: false, message: "Error interno" });
    } finally {
        connection.release();
    }
});
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

// OBTENER HISTORIAL DE COMPRAS/APARTADOS
app.get('/api/reservaciones/usuario/:id', async (req, res) => {
    try {
        const query = `
            SELECT r.id_reservacion AS id_reserva, r.cantidad, r.estado_reserva, r.fecha_reserva,
                   TIMESTAMPDIFF(SECOND, NOW(), r.fecha_reserva + INTERVAL 1 HOUR) AS segundos_restantes,
                   p.nombre_pack, p.precio_descuento, p.foto_pack, 
                   c.nombre_comercio, c.direccion_comercio
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
// E. OBTENER GANANCIAS REALES DEL LOCAL
// ==========================================
app.get('/api/ganancias/comercio/:userId', async (req, res) => {
    try {
        const [comercio] = await pool.query('SELECT id_comercio FROM comercio WHERE usuario_id = ?', [req.params.userId]);
        if (comercio.length === 0) return res.status(404).json({ success: false });

        const [ganancias] = await pool.query(`
            SELECT monto, motivo_pago AS motivo, DATE_FORMAT(fecha, '%d/%m/%Y %H:%i') AS fecha 
            FROM ganancias_local 
            WHERE comercio_id = ? 
            ORDER BY id_ganancia DESC
        `, [comercio[0].id_comercio]);

        res.json({ success: true, ganancias });
    } catch (error) {
        console.error("Error al obtener ganancias:", error);
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
// INICIO DEL SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3005;
app.listen(PORT, () => {
    console.log(`🚀 Food-Loop ejecutándose en http://localhost:${PORT}`);
});

export default app;