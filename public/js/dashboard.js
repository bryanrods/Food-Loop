document.addEventListener('DOMContentLoaded', async () => {
    // 1. Verificamos si hay una sesión activa en el navegador
    const usuarioGuardado = localStorage.getItem('usuarioFoodLoop');
    
    if (!usuarioGuardado) {
        window.location.href = 'login.html';
        return; 
    }

    const usuarioLocal = JSON.parse(usuarioGuardado);

    try {
        // 2. Le preguntamos a tu servidor (Azure) por los datos reales y frescos
        const respuesta = await fetch('http://localhost:3005/api/me', {
            method: 'GET',
            headers: { 'user-id': usuarioLocal.id }
        });

        const resultado = await respuesta.json();

        if (resultado.success) {
            // 3. Pintamos el nombre del usuario
            const saludoElemento = document.getElementById('nombre-usuario');
            if (saludoElemento) {
                saludoElemento.textContent = resultado.user.nombre_usuario;
            }
            
            // 4. ¡LA MAGIA DEL FOLIO! Pintamos el folio oficial que viene de la base de datos
            const elementoFolio = document.getElementById('numero-folio');
            if (elementoFolio && resultado.user.folio_usuario) {
                elementoFolio.textContent = resultado.user.folio_usuario;
                // Le ponemos un pequeño estilo dinámico si quieres que resalte que ya cargó
                elementoFolio.style.color = 'var(--color-primary)';
            }
            
        } else {
            // Si el servidor no lo reconoce, lo sacamos por seguridad
            localStorage.removeItem('usuarioFoodLoop');
            window.location.href = 'login.html';
        }
    } catch (error) {
        console.error("Error al validar la sesión con el servidor:", error);
    }
});