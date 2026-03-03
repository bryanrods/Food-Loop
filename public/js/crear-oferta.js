document.getElementById('form-crear-pack').addEventListener('submit', async (e) => {
    e.preventDefault();

    const usuario = JSON.parse(localStorage.getItem('usuarioFoodLoop'));
    
    // Solo un local puede publicar
    if (!usuario || usuario.rol !== 'local') {
        alert("Acceso no autorizado");
        window.location.href = 'login.html';
        return;
    }

    const datosPack = {
        comercio_id: usuario.id,
        nombre_pack: document.getElementById('nombre_pack').value,
        descripcion: document.getElementById('descripcion').value,
        precio_original: document.getElementById('precio_original').value,
        precio_descuento: document.getElementById('precio_descuento').value,
        stock: document.getElementById('stock').value,
        hora_activacion: document.getElementById('hora_activacion').value
    };

    try {
        const respuesta = await fetch('http://localhost:3005/api/packs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datosPack)
        });

        const resultado = await respuesta.json();

        if (resultado.success) {
            alert('🎉 ' + resultado.message);
            window.location.href = 'dashboard-local.html';
        } else {
            alert('Error al publicar: ' + resultado.message);
        }
    } catch (error) {
        console.error("Error:", error);
        alert("No se pudo conectar con el servidor.");
    }
});