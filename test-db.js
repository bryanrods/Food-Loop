
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
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function getComercioData() {
    console.log('⏳ Conectando para consultar la tabla "pack"...');
    
    try {
        const connection = await mysql.createConnection({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASS,
            database: process.env.DB_NAME,
            ssl: {
                rejectUnauthorized: false 
            }
        });

        // 1. Ejecutamos la consulta para traer todos los registros de la tabla comercio
        // Nota: Asegúrate de que el nombre exacto de la tabla sea 'comercio'
        const [rows] = await connection.execute('SELECT * FROM usuario;');

        if (rows.length === 0) {
            console.log('⚠️ La tabla "usuario" está vacía.');
        } else {
            console.log(`✅ Se encontraron ${rows.length} registros en "reservacion":`);
            // console.table es genial para visualizar datos de bases de datos en la terminal
            console.table(rows);
        }

        await connection.end();
        console.log('🔌 Conexión cerrada.');

    } catch (error) {
        console.error('❌ Error al consultar la tabla:');
        console.error(error.message);
    }
}

getComercioData();



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