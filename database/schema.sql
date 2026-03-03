-- Eliminar tablas si existen para poder correr el script desde cero sin errores
DROP TABLE IF EXISTS reservacion;
DROP TABLE IF EXISTS pack;
DROP TABLE IF EXISTS suscripcion_pago;
DROP TABLE IF EXISTS suscripcion_info;
DROP TABLE IF EXISTS comercio;
DROP TABLE IF EXISTS usuario;

-- 1. Tabla de Usuarios
CREATE TABLE usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,
    nombre_usuario VARCHAR(50) NOT NULL,
    pswrd_usuario VARCHAR(255) NOT NULL, -- Corregido a 255 para soportar hashes
    email_usuario VARCHAR(50) UNIQUE NOT NULL,
    fecha_creacion DATE NOT NULL,
    rol_usuario VARCHAR(20) NOT NULL -- 'admin', 'local', o 'usuario'
);

-- 2. Tabla de Comercios
CREATE TABLE comercio (
    id_comercio INT AUTO_INCREMENT PRIMARY KEY,
    nombre_comercio VARCHAR(100) NOT NULL, -- Corregido de INT a VARCHAR
    direccion_comercio VARCHAR(100) NOT NULL,
    telefono_comercio VARCHAR(20) NOT NULL,
    usuario_id INT NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuario(id_usuario) ON DELETE CASCADE
);

-- 3. Tabla de Información de Suscripción
CREATE TABLE suscripcion_info (
    id_suscripcion INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    tipo_plan VARCHAR(30) NOT NULL, -- 'basico' o 'premium'
    estado_suscripcion VARCHAR(30) NOT NULL, -- 'activa', 'inactiva', 'cancelada'
    fecha_corte DATE NOT NULL,
    FOREIGN KEY (usuario_id) REFERENCES usuario(id_usuario) ON DELETE CASCADE
);

-- 4. Tabla de Pagos de Suscripción
CREATE TABLE suscripcion_pago (
    id_pago_suscrip INT AUTO_INCREMENT PRIMARY KEY,
    suscripcion_id INT NOT NULL,
    monto_pago DECIMAL(10,2) NOT NULL,
    dia_cobro DATE NOT NULL,
    estado_pago VARCHAR(30) NOT NULL,
    referencia_pago VARCHAR(50) NOT NULL,
    FOREIGN KEY (suscripcion_id) REFERENCES suscripcion_info(id_suscripcion) ON DELETE CASCADE
);

-- 5. NUEVA TABLA: Packs (Excedentes de comida)
CREATE TABLE pack (
    id_pack INT AUTO_INCREMENT PRIMARY KEY,
    comercio_id INT NOT NULL,
    nombre_pack VARCHAR(100) NOT NULL,
    descripcion TEXT,
    precio_original DECIMAL(10,2) NOT NULL,
    precio_descuento DECIMAL(10,2) NOT NULL,
    stock_disponible INT NOT NULL,
    hora_activacion TIME NOT NULL, -- Para la regla "después de cierta hora"
    estado VARCHAR(20) DEFAULT 'disponible',
    FOREIGN KEY (comercio_id) REFERENCES comercio(id_comercio) ON DELETE CASCADE
);

-- 6. NUEVA TABLA: Reservaciones (Apartados)
CREATE TABLE reservacion (
    id_reservacion INT AUTO_INCREMENT PRIMARY KEY,
    usuario_id INT NOT NULL,
    pack_id INT NOT NULL,
    cantidad INT NOT NULL,
    fecha_reserva DATETIME DEFAULT CURRENT_TIMESTAMP,
    estado_reserva VARCHAR(20) DEFAULT 'pendiente', -- 'pendiente', 'completada', 'cancelada'
    FOREIGN KEY (usuario_id) REFERENCES usuario(id_usuario),
    FOREIGN KEY (pack_id) REFERENCES pack(id_pack)
);