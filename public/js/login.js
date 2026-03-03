document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form'); 

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 

            // ¡AQUÍ ESTÁ LA MAGIA! Ahora busca 'username' tal como está en tu HTML
            const email = document.getElementById('username').value;
            const password = document.getElementById('password').value;

            try {
                const respuesta = await fetch('http://localhost:3005/auth/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });

                const resultado = await respuesta.json();

                if (resultado.success) {
                    alert('¡Bienvenido de vuelta a Food-Loop, ' + resultado.user.nombre + '!');
                    
                    // Guardamos los datos
                    localStorage.setItem('usuarioFoodLoop', JSON.stringify(resultado.user));
                    
                    // Lo mandamos a su panel
                    window.location.href = 'dashboard-usuario.html'; 
                } else {
                    alert('Error: ' + resultado.message); 
                }
            } catch (error) {
                console.error('Error detallado:', error);
                alert('No se pudo conectar. ¿El servidor en el 3005 sigue encendido?');
            }
        });
    }
});