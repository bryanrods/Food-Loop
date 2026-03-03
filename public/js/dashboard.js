document.addEventListener('DOMContentLoaded', async () => {
    const usuarioGuardado = localStorage.getItem('usuarioFoodLoop');
    
    // 1. Verificación básica: ¿Hay un gafete en el navegador?
    if (!usuarioGuardado) {
        window.location.href = 'login.html';
        return; 
    }

    const usuarioLocal = JSON.parse(usuarioGuardado);

    try {
        // 2. VERIFICACIÓN AVANZADA (GET /me): Le preguntamos a Azure si el gafete es real
        const respuesta = await fetch('http://localhost:3005/api/me', {
            method: 'GET',
            headers: {
                'user-id': usuarioLocal.id // Mandamos el ID oculto en los headers
            }
        });

        const resultado = await respuesta.json();

        if (resultado.success) {
            // El servidor confirmó que es real. Ponemos su nombre.
            const saludoElemento = document.getElementById('nombre-usuario');
            if (saludoElemento) {
                saludoElemento.textContent = resultado.user.nombre_usuario;
            }
            
            // ¡AQUÍ ESTÁ LA MAGIA DEL ROL!
            console.log("Rol oficial validado por Azure:", resultado.user.rol_usuario);
            
            // Más adelante usaremos esto para decir: 
            // "Si rol es 'local', muéstrale el botón de 'Publicar Comida'"
            
        } else {
            // Si el servidor dice que es falso o lo borraron de la BD, lo sacamos.
            localStorage.removeItem('usuarioFoodLoop');
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error("Error al validar la sesión con el servidor:", error);
    }
});