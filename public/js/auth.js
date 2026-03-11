document.addEventListener('DOMContentLoaded', () => {
    const registroForm = document.getElementById('registration-form');
    if (!registroForm) return;

    // --- 1. RESTRICCIONES DE TECLADO (Keydown) ---
    const nameInput = document.getElementById('name');
    const phoneInput = document.getElementById('phone');

    if (nameInput) {
        nameInput.addEventListener('keydown', function(e) {
            const allowedKeys = ['Backspace', 'Tab', 'Enter', 'Escape', ' ', 'ArrowLeft', 'ArrowRight', 'Delete'];
            if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;
            if (!/^[a-zA-ZÀ-ÿ]$/.test(e.key)) {
                e.preventDefault();
            }
        });
    }

    if (phoneInput) {
        phoneInput.addEventListener('keydown', function(e) {
            const allowedKeys = ['Backspace', 'Tab', 'Enter', 'Escape', 'ArrowLeft', 'ArrowRight', 'Delete'];
            if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) return;
            if (!/^[0-9]$/.test(e.key)) {
                e.preventDefault();
            }
        });
    }

    // --- 2. VALIDACIÓN INSTANTÁNEA (Input) ---
    const validators = {
        name: (val) => val.trim().length > 0 && /^[a-zA-ZÀ-ÿ\s]+$/.test(val),
        age: (val) => val.trim() !== '' && parseInt(val) >= 18,
        phone: (val) => val.trim().length === 10 && /^\d{10}$/.test(val),
        email: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
        password: (val) => val.trim().length >= 8,
        confirm: (val) => val === document.getElementById('password').value && val.trim() !== ''
    };

    const inputs = ['name', 'age', 'phone', 'email', 'password', 'confirm'];

    inputs.forEach(id => {
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

    // --- 3. ENVÍO DEL FORMULARIO ---
    registroForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        let isValid = true;

        // Validar campos de texto
        inputs.forEach(id => {
            const el = document.getElementById(id);
            const errEl = document.getElementById(`${id}Error`);
            if (el && errEl && !validators[id](el.value)) {
                errEl.style.display = 'block';
                el.classList.add('input-error');
                isValid = false;
            }
        });

        if (!isValid) return;

        const datos = {
            nombre: nameInput.value,
            edad: parseInt(document.getElementById('age').value),
            telefono: phoneInput.value,
            email: document.getElementById('email').value,
            password: document.getElementById('password').value,
            plan: document.querySelector('input[name="subscription_plan"]:checked')?.id === 'plan-premium' ? 'premium' : 'basico',
            rol: 'usuario'
        };

        try {
            const respuesta = await fetch('http://localhost:3005/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(datos)
            });

            const resultado = await respuesta.json();

            if (resultado.success) {
                alert('¡Suscripción exitosa en Azure!');
                window.location.href = 'login.html';
            } else {
                alert('Error al registrar: ' + (resultado.message || 'Inténtalo de nuevo.'));
            }
        } catch (error) {
            console.error('Error detallado:', error);
            alert('Hubo un problema con el registro. Intenta de nuevo.');
        }
    });
});