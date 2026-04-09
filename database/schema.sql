-- Eliminar tablas si existen para poder correr el script desde cero sin errores
DROP TABLE IF EXISTS suscripcion_pago;
DROP TABLE IF EXISTS suscripcion_info;
DROP TABLE IF EXISTS ganancias_local;
DROP TABLE IF EXISTS reservacion;
DROP TABLE IF EXISTS pack;
DROP TABLE IF EXISTS comercio;
DROP TABLE IF EXISTS datos_usuario;
DROP TABLE IF EXISTS usuario;

-- 1. Tabla de Usuarios
    CREATE TABLE `usuario` (
  `id_usuario` int NOT NULL AUTO_INCREMENT,
  `nombre_usuario` varchar(50) NOT NULL,
  `pswrd_usuario` varchar(255) NOT NULL,
  `email_usuario` varchar(50) NOT NULL,
  `fecha_creacion` date NOT NULL,
  `rol_usuario` varchar(20) NOT NULL,
  `activo` tinyint(1) DEFAULT '1',
  PRIMARY KEY (`id_usuario`),
  UNIQUE KEY `email_usuario` (`email_usuario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

-- 2. Tabla de Comercios
    CREATE TABLE `comercio` (
  `id_comercio` int NOT NULL AUTO_INCREMENT,
  `nombre_comercio` varchar(100) NOT NULL,
  `direccion_comercio` varchar(100) NOT NULL,
  `telefono_comercio` varchar(20) NOT NULL,
  `usuario_id` int NOT NULL,
  `foto_local` varchar(255) DEFAULT NULL,
  `hora_apertura` time DEFAULT NULL,
  `hora_cierre` time DEFAULT NULL,
  `estado_operativo` enum('abierto','cerrado') DEFAULT 'abierto',
  PRIMARY KEY (`id_comercio`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `comercio_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

-- 3. Tabla de Información de Suscripción
    CREATE TABLE `suscripcion_info` (
  `id_suscripcion` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `tipo_plan` varchar(30) NOT NULL,
  `estado_suscripcion` varchar(30) NOT NULL,
  `fecha_corte` date DEFAULT NULL,
  `folio_suscripcion` varchar(20) DEFAULT NULL,
  PRIMARY KEY (`id_suscripcion`),
  UNIQUE KEY `folio_suscripcion` (`folio_suscripcion`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `suscripcion_info_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

-- 4. Tabla de Pagos de Suscripción
    CREATE TABLE `suscripcion_pago` (
  `id_pago_suscrip` int NOT NULL AUTO_INCREMENT,
  `suscripcion_id` int NOT NULL,
  `monto_pago` decimal(10,2) NOT NULL,
  `dia_cobro` date NOT NULL,
  `estado_pago` varchar(30) NOT NULL,
  `referencia_pago` varchar(50) NOT NULL,
  `comercio_id` int DEFAULT NULL,
  PRIMARY KEY (`id_pago_suscrip`),
  KEY `suscripcion_id` (`suscripcion_id`),
  KEY `fk_cobro_local` (`comercio_id`),
  CONSTRAINT `fk_cobro_local` FOREIGN KEY (`comercio_id`) REFERENCES `comercio` (`id_comercio`) ON DELETE SET NULL,
  CONSTRAINT `suscripcion_pago_ibfk_1` FOREIGN KEY (`suscripcion_id`) REFERENCES `suscripcion_info` (`id_suscripcion`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

-- 5. NUEVA TABLA: Packs (Excedentes de comida)
    CREATE TABLE `pack` (
  `id_pack` int NOT NULL AUTO_INCREMENT,
  `comercio_id` int NOT NULL,
  `nombre_pack` varchar(100) NOT NULL,
  `descripcion` text,
  `precio_original` decimal(10,2) NOT NULL,
  `precio_descuento` decimal(10,2) NOT NULL,
  `stock_disponible` int NOT NULL,
  `hora_activacion` time NOT NULL,
  `estado` varchar(20) DEFAULT 'disponible',
  `foto_pack` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_pack`),
  KEY `comercio_id` (`comercio_id`),
  CONSTRAINT `pack_ibfk_1` FOREIGN KEY (`comercio_id`) REFERENCES `comercio` (`id_comercio`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

-- 6. NUEVA TABLA: Reservaciones (Apartados)
    CREATE TABLE `reservacion` (
  `id_reservacion` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `pack_id` int NOT NULL,
  `cantidad` int NOT NULL,
  `fecha_reserva` datetime DEFAULT CURRENT_TIMESTAMP,
  `estado_reserva` varchar(20) DEFAULT 'pendiente',
  `total` decimal(10,2) NOT NULL DEFAULT '0.00',
  PRIMARY KEY (`id_reservacion`),
  KEY `usuario_id` (`usuario_id`),
  KEY `pack_id` (`pack_id`),
  CONSTRAINT `reservacion_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id_usuario`),
  CONSTRAINT `reservacion_ibfk_2` FOREIGN KEY (`pack_id`) REFERENCES `pack` (`id_pack`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

    CREATE TABLE `datos_usuario` (
  `id_datos` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `edad` int NOT NULL,
  `telefono` varchar(15) NOT NULL,
  `foto_usuario` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id_datos`),
  KEY `usuario_id` (`usuario_id`),
  CONSTRAINT `datos_usuario_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuario` (`id_usuario`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci

--8. NUEVA TABLA: ganancias_local
    CREATE TABLE `ganancias_local` (
  `id_ganancia` int NOT NULL AUTO_INCREMENT,
  `comercio_id` int NOT NULL,
  `reservacion_id` int DEFAULT NULL,
  `monto` decimal(10,2) NOT NULL,
  `motivo_pago` varchar(255) NOT NULL,
  `fecha` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_ganancia`),
  KEY `comercio_id` (`comercio_id`),
  KEY `reservacion_id` (`reservacion_id`),
  CONSTRAINT `ganancias_local_ibfk_1` FOREIGN KEY (`comercio_id`) REFERENCES `comercio` (`id_comercio`),
  CONSTRAINT `ganancias_local_ibfk_2` FOREIGN KEY (`reservacion_id`) REFERENCES `reservacion` (`id_reservacion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci
