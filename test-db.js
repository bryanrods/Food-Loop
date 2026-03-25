
                                    /* Consulta de TABLAS en base de datos*/

// import mysql from 'mysql2/promise';
// import dotenv from 'dotenv';

// dotenv.config();

// async function verTablas() {
//     console.log('🔍 Conectando a Azure para ver la estructura de tu base de datos...');
    
//     try {
//         const connection = await mysql.createConnection({
//             host: process.env.DB_HOST,
//             port: process.env.DB_PORT,
//             user: process.env.DB_USER,
//             password: process.env.DB_PASS,
//             database: process.env.DB_NAME,
//             ssl: { rejectUnauthorized: false }
//         });

//         // El comando de MySQL para listar todas las tablas
//         const [rows] = await connection.execute('SHOW TABLES;');

//         if (rows.length === 0) {
//             console.log('\n📭 Tu base de datos está completamente vacía. No hay tablas.');
//         } else {
//             console.log(`\n📂 Tienes ${rows.length} tablas en total:`);
//             console.table(rows);
//         }

//         await connection.end();

//     } catch (error) {
//         console.error('❌ Error al consultar las tablas:', error.message);
//     }
// }

// verTablas();



                                                    /*CONSULTA DE TABLA INDIVIDUAL */
// import mysql from 'mysql2/promise';
// import dotenv from 'dotenv';

// dotenv.config();

// async function getComercioData() {
//     console.log('⏳ Conectando para consultar la tabla "pack"...');
    
//     try {
//         const connection = await mysql.createConnection({
//             host: process.env.DB_HOST,
//             port: process.env.DB_PORT,
//             user: process.env.DB_USER,
//             password: process.env.DB_PASS,
//             database: process.env.DB_NAME,
//             ssl: {
//                 rejectUnauthorized: false 
//             }
//         });

//         // 1. Ejecutamos la consulta para traer todos los registros de la tabla comercio
//         // Nota: Asegúrate de que el nombre exacto de la tabla sea 'comercio'
//         const [rows] = await connection.execute('SELECT * FROM usuario;');

//         if (rows.length === 0) {
//             console.log('⚠️ La tabla "reservacion" está vacía.');
//         } else {
//             console.log(`✅ Se encontraron ${rows.length} registros en "reservacion":`);
//             // console.table es genial para visualizar datos de bases de datos en la terminal
//             console.table(rows);
//         }

//         await connection.end();
//         console.log('🔌 Conexión cerrada.');

//     } catch (error) {
//         console.error('❌ Error al consultar la tabla:');
//         console.error(error.message);
//     }
// }

// getComercioData();


                            /*Borrado TOTAL de datos  */
// import mysql from 'mysql2/promise';
// import dotenv from 'dotenv';
// import fs from 'fs';
// import path from 'path';

// dotenv.config();

// async function resetNuclear() {
//     console.log('⚠️ INICIANDO PROTOCOLO NUCLEAR: DESTRUCCIÓN DE DATOS Y FOTOS...');
    
//     // ==========================================
//     // FASE 1: BARRIDO FÍSICO (FOTOS)
//     // ==========================================
//     const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
    
//     try {
//         if (fs.existsSync(uploadsDir)) {
//             const archivos = fs.readdirSync(uploadsDir);
//             let borrados = 0;
            
//             for (const archivo of archivos) {
//                 // Evitamos borrar carpetas ocultas o archivos del sistema si los hubiera
//                 if (archivo !== '.gitkeep') { 
//                     fs.unlinkSync(path.join(uploadsDir, archivo));
//                     borrados++;
//                 }
//             }
//             console.log(`🧹 FASE 1 COMPLETADA: ${borrados} foto(s) eliminada(s) físicamente del servidor.`);
//         } else {
//             console.log('⚠️ La carpeta public/uploads no existe, saltando barrido físico.');
//         }
//     } catch (err) {
//         console.error('❌ Error al intentar borrar las fotos físicas:', err.message);
//     }

//     // ==========================================
//     // FASE 2: BARRIDO LÓGICO (BASE DE DATOS)
//     // ==========================================
//     try {
//         const connection = await mysql.createConnection({
//             host: process.env.DB_HOST,
//             port: process.env.DB_PORT,
//             user: process.env.DB_USER,
//             password: process.env.DB_PASS,
//             database: process.env.DB_NAME,
//             ssl: { rejectUnauthorized: false }
//         });

//         // Apagamos llaves foráneas para evitar bloqueos
//         await connection.execute('SET FOREIGN_KEY_CHECKS = 0;');
        
//         const tablas = [
//             'comercio', 
//             'datos_usuario', 
//             'suscripcion_info', 
//             'reservacion', 
//             'pack',      
//             'usuario'
//         ];

//         for (const tabla of tablas) {
//             await connection.execute(`TRUNCATE TABLE ${tabla};`);
//         }

//         // Encendemos seguridad de nuevo
//         await connection.execute('SET FOREIGN_KEY_CHECKS = 1;');

//         console.log(`🧹 FASE 2 COMPLETADA: ${tablas.length} tablas vaciadas y IDs reiniciados a 1.`);
//         console.log('\n✅ PROTOCOLO EXITOSO: Tu sistema está como recién instalado.');

//         await connection.end();

//     } catch (error) {
//         console.error('❌ Error en la base de datos durante la demolición:', error.message);
//     }
// }

// resetNuclear();

                                        /*Borrar columnas en TABLAS */

// import mysql from 'mysql2/promise';
// import dotenv from 'dotenv';

// dotenv.config();

// async function reestructurarFotos() {
//     console.log('⏳ Conectando a Azure para reestructurar las tablas...');
//     try {
//         const connection = await mysql.createConnection({
//             host: process.env.DB_HOST,
//             port: process.env.DB_PORT,
//             user: process.env.DB_USER,
//             password: process.env.DB_PASS,
//             database: process.env.DB_NAME,
//             ssl: { rejectUnauthorized: false }
//         });

//         console.log('🛠️ 1. Eliminando foto_perfil de la tabla usuario (si existe)...');
//         try { await connection.execute('ALTER TABLE usuario DROP COLUMN foto_perfil;'); } catch(e) {}

//         console.log('🛠️ 2. Añadiendo foto_local a la tabla comercio...');
//         try { await connection.execute('ALTER TABLE comercio ADD COLUMN foto_local VARCHAR(255) DEFAULT NULL;'); } catch(e) {}

//         console.log('🛠️ 3. Añadiendo foto_usuario a la tabla datos_usuario...');
//         try { await connection.execute('ALTER TABLE datos_usuario ADD COLUMN foto_usuario VARCHAR(255) DEFAULT NULL;'); } catch(e) {}

//         console.log('✅ ¡Migración perfecta! Tablas listas para la nueva lógica.');
//         await connection.end();
//     } catch (error) {
//         console.error('❌ Error crítico en la migración:', error.message);
//         process.exit(1);
//     }
// }
// reestructurarFotos();

                                        /*AGREGAR COLUMNA A TABLAS*/
// import mysql from 'mysql2/promise';
// import dotenv from 'dotenv';
// dotenv.config();

// async function actualizarTablaReservacion() {
//     console.log('⏳ Conectando a la base de datos de Food Loop...');
//     try {
//         const connection = await mysql.createConnection({
//             host: process.env.DB_HOST,
//             port: process.env.DB_PORT,
//             user: process.env.DB_USER,
//             password: process.env.DB_PASS,
//             database: process.env.DB_NAME,
//             ssl: { rejectUnauthorized: false }
//         });

//         console.log('🛠️ Inyectando la columna "total" en la tabla reservacion...');
        
//         // Agregamos la columna como DECIMAL (para manejar centavos)
//         await connection.execute(`
//             ALTER TABLE reservacion 
//             ADD COLUMN total DECIMAL(10,2) NOT NULL DEFAULT 0.00 AFTER estado_reserva;
//         `);

//         console.log('✅ ¡Operación exitosa! La columna "total" ha sido creada.');
//         await connection.end();
//     } catch (error) {
//         // Si el error es "Duplicate column name", significa que ya la tenías y no pasa nada.
//         if (error.code === 'ER_DUP_FIELDNAME') {
//             console.log('⚠️ La columna "total" ya existe. ¡Estás listo para continuar!');
//         } else {
//             console.error('❌ Error crítico:', error.message);
//         }
//     }
// }

// actualizarTablaReservacion();


                                        /* CONSULTAR COLUMNAS DE TABLA */
// import mysql from 'mysql2/promise';
// import dotenv from 'dotenv';

// dotenv.config();

// async function verColumnasPack() {    
//     try {
//         const connection = await mysql.createConnection({
//             host: process.env.DB_HOST,
//             port: process.env.DB_PORT,
//             user: process.env.DB_USER,
//             password: process.env.DB_PASS,
//             database: process.env.DB_NAME,
//             ssl: { rejectUnauthorized: false }
//         });

//         // DESCRIBE nos devuelve el nombre de las columnas, sus tipos de datos y si aceptan nulos
//         const [rows] = await connection.execute('DESCRIBE reservacion;');

//         console.log('\n📋 Estructura exacta de la tabla "suscripcion_pago":');
//         console.table(rows);

//         await connection.end();

//     } catch (error) {
//         console.error('❌ Error al consultar la tabla:', error.message);
//     }
// }

// verColumnasPack();

// import mysql from 'mysql2/promise';
// import dotenv from 'dotenv';
// dotenv.config();

// async function crearTablaGananciasLocal() {
//     console.log('⏳ Conectando a la base de datos de Food Loop...');

//     let connection;

//     try {
//         // ==========================================
//         // 1. CONEXIÓN A LA BASE DE DATOS
//         // ==========================================
//         connection = await mysql.createConnection({
//             host: process.env.DB_HOST,
//             port: process.env.DB_PORT,
//             user: process.env.DB_USER,
//             password: process.env.DB_PASS,
//             database: process.env.DB_NAME,
//             ssl: { rejectUnauthorized: false }
//         });

//         console.log('✅ Conexión establecida correctamente.');

//         // ==========================================
//         // 2. CREAR TABLA ganancias_local
//         // ==========================================
//         console.log('🛠️ Verificando / creando la tabla "ganancias_local"...');

//         await connection.execute(`
//             CREATE TABLE IF NOT EXISTS ganancias_local (
//                 id_ganancia INT AUTO_INCREMENT PRIMARY KEY,
//                 fecha_pago DATE NOT NULL,
//                 motivo_pago VARCHAR(255) NOT NULL,
//                 monto_pagado DECIMAL(10,2) NOT NULL,
//                 id_local INT NOT NULL
//             );
//         `);

//         console.log('✅ ¡Operación exitosa! La tabla "ganancias_local" ya está lista.');

//     } catch (error) {
//         console.error('❌ Error crítico al crear la tabla "ganancias_local":', error.message);
//         console.error('📌 Detalle completo del error:', error);
//     } finally {
//         // ==========================================
//         // 3. CERRAR CONEXIÓN
//         // ==========================================
//         if (connection) {
//             await connection.end();
//             console.log('🔌 Conexión cerrada correctamente.');
//         }
//     }
// }

// crearTablaGananciasLocal();
