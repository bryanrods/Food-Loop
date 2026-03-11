document.addEventListener('DOMContentLoaded', () => {
    const formRegistroLocal = document.getElementById('form-registro-local');

    if (!formRegistroLocal) return;

    // --- RESTRICCIONES FÍSICAS DE TECLADO ---
    const phoneInput = document.getElementById('phone');
    const nombreDuenoInput = document.getElementById('nombre-dueno');
    
    // Bloquear letras en teléfono
    if (phoneInput) {
        phoneInput.addEventListener('keydown', function(e) {
            const allowedKeys = ['Backspace', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'Delete'];
            if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;
            if (!/^[0-9]$/.test(e.key)) {
                e.preventDefault();
            }
        });
    }

    // Bloquear números y símbolos en nombre del dueño
    if (nombreDuenoInput) {
        nombreDuenoInput.addEventListener('keydown', function(e) {
            const allowedKeys = ['Backspace', 'Tab', 'Enter', 'Escape', ' ', 'ArrowLeft', 'ArrowRight', 'Delete'];
            if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;
            if (!/^[a-zA-ZÀ-ÿ]$/.test(e.key)) {
                e.preventDefault();
            }
        });
    }

    // --- VALIDACIÓN INSTANTÁNEA ---
    const validators = {
        'nombre-local': (val) => val.trim().length > 0,
        'nombre-dueno': (val) => val.trim().length > 0 && /^[a-zA-ZÀ-ÿ\s]+$/.test(val),
        'address': (val) => val.trim().length > 5,
        'phone': (val) => val.trim().length === 10 && /^\d{10}$/.test(val),
        'email-local': (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
        'password-local': (val) => val.trim().length >= 8,
        'confirm-local': (val) => val === document.getElementById('password-local').value && val.trim() !== ''
    };

    const inputsToValidate = Object.keys(validators);

    inputsToValidate.forEach(id => {
        const el = document.getElementById(id);
        const errEl = document.getElementById(`${id}Error`);
        
        if (el && errEl) {
            el.addEventListener('input', () => {
                if (validators[id](el.value)) {
                    errEl.style.display = 'none';
                    el.classList.remove('input-error');
                } else {
                    errEl.style.display = 'block';
                    el.classList.add('input-error');
                }
            });
        }
    });

    // --- ENVÍO DE DATOS AL SERVIDOR ---
    formRegistroLocal.addEventListener('submit', async (e) => {
        e.preventDefault(); 

        let isFormValid = true;

        // Validar todo antes de enviar
        inputsToValidate.forEach(id => {
            const el = document.getElementById(id);
            const errEl = document.getElementById(`${id}Error`);
            if (el && errEl) {
                if (!validators[id](el.value)) {
                    errEl.style.display = 'block';
                    el.classList.add('input-error');
                    isFormValid = false;
                }
            }
        });

        if (!isFormValid) {
            return; // Se detiene si hay errores
        }

        // Extraemos los datos estructurados para tus dos tablas
        const payload = {
            nombre_usuario: document.getElementById('nombre-dueno').value,
            nombre_comercio: document.getElementById('nombre-local').value,
            email: document.getElementById('email-local').value,
            password: document.getElementById('password-local').value,
            direccion: document.getElementById('address').value,
            telefono: document.getElementById('phone').value,
            rol: 'local'
        };

        try {
            const respuesta = await fetch('http://localhost:3005/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const resultado = await respuesta.json();

            if (resultado.success) {
                alert('🏪 ¡Bienvenido a Food-Loop! Tu comercio ha sido registrado con éxito. Por favor inicia sesión.');
                window.location.href = 'login.html'; 
            } else {
                alert('Error al registrar: ' + (resultado.message || 'Inténtalo de nuevo.'));
            }
        } catch (error) {
            console.error('Error detallado:', error);
            alert('No se pudo conectar con el servidor. Verifica tu conexión.');
        }
    });
});