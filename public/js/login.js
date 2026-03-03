document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form'); 

    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault(); 

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
                    // 1. Guardamos los datos completos (incluyendo el ID y el ROL)
                    localStorage.setItem('usuarioFoodLoop', JSON.stringify(resultado.user));
                    
                    // 2. LA GRAN DECISIÓN: ¿A dónde lo mandamos?
                    if (resultado.user.rol === 'local') {
                        alert('🏪 Bienvenido, Socio Comercial. Entrando al Panel de Negocios.');
                        window.location.href = 'dashboard-local.html'; //
                    } else {
                        alert('👋 ¡Hola, ' + resultado.user.nombre + '! Entrando a Food-Loop.');
                        window.location.href = 'dashboard-usuario.html';
                    }
                    
                } else {
                    alert('Error: ' + resultado.message); 
                }
            } catch (error) {
                console.error('Error detallado:', error);
                alert('No se pudo conectar. Revisa que el servidor 3005 esté encendido.');
            }
        });
    }
});