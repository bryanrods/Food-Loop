# 🥗 Food-Loop - Plataforma de Rescate de Alimentos

Food-Loop es una Progressive Web App (PWA) diseñada para conectar comercios locales que tienen excedentes de comida con usuarios interesados en adquirirlos a precios reducidos, reduciendo así el desperdicio alimentario.

## 📋 Requisitos Previos

Antes de comenzar, asegúrate de tener instalado:

- [Node.js](https://nodejs.org/) (Versión 16 o superior)
- Acceso a una base de datos MySQL (Azure)
- Un túnel SSH activo si la base de datos es remota (Puerto 3307 configurado)

---

## 🚀 Instalación y Configuración

Sigue estos pasos para levantar el entorno de desarrollo:

### 1. Configurar Variables de Entorno

Crea un archivo llamado `.env` en la raíz del proyecto y añade tus credenciales. **Nota:** Este archivo está excluido en el `.gitignore` por seguridad.

```env
DB_HOST=127.0.0.1
DB_PORT=3307
DB_USER=tu_usuario
DB_PASS=tu_password
DB_NAME=foodLoop
PORT=3005
```

2. Preparar la Base de Datos
   Ejecuta los scripts SQL en tu instancia de Azure en el siguiente orden para asegurar la integridad de las llaves foráneas:

Correr database/schema.sql: Crea la estructura de tablas (usuario, comercio, pack, reservacion, etc.).

Correr database/seed.sql: Inserta datos iniciales de prueba para comercios y packs.

3. Instalar Dependencias e Iniciar
   En tu terminal, ejecuta los siguientes comandos:

Bash

# Instalar módulos de Node

npm install

# Iniciar el servidor

npm start
El servidor estará corriendo en: http://localhost:3005

🛠️ Estructura del Proyecto
/public: Archivos del frontend (HTML, CSS, JS).

/database: Scripts de inicialización SQL.

server.js: Servidor Express con la lógica de la API.

.env: Configuración sensible (No incluido en repositorio).

🧪 Pruebas Automatizadas
Para ejecutar las pruebas de validación requeridas por la rúbrica (Login, Roles y Reservas), utiliza el comando:

Bash
npm test
👥 Autores
Sebastián Yacob Loya Estrada

Kevin Yuseth Pinacho Gómez

Bryan Rodríguez Torres

Leslie Marisol Zúñiga Pineda
