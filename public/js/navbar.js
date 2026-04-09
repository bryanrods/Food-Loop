async function cargarYConfigurarNavbar() {
    const placeholder = document.getElementById('navbar-placeholder');
    if (!placeholder) {
        // Si no hay placeholder (como en los Dashboards), solo ejecutamos la limpieza
        ajustarVisibilidadNav();
        return;
    }

    try {
        const response = await fetch('navbar.html');
        const html = await response.text();
        placeholder.innerHTML = html;

        ajustarVisibilidadNav();
        configurarHamburguesa();
    } catch (error) {
        console.error("Error cargando la navbar:", error);
    }
}

function ajustarVisibilidadNav() {
    const session = localStorage.getItem('usuarioFoodLoop');
    const invitados = document.querySelectorAll('.solo-invitados');
    const usuarios = document.querySelectorAll('.solo-usuarios');
    const linkPerfil = document.getElementById('link-dinamico-perfil');

    if (session) {
        const user = JSON.parse(session);
        // Ocultar login/unirme
        invitados.forEach(el => el.style.display = 'none');
        // Mostrar perfil/cerrar sesión
        usuarios.forEach(el => el.style.display = 'inline-block');

        // Si es Local, el botón de "Mi Perfil" lo mandamos a su panel
        if (user.rol === 'local' && linkPerfil) {
            linkPerfil.href = 'dashboard-local.html';
        }
    } else {
        // Si no hay nadie, mostrar login y ocultar perfil
        invitados.forEach(el => el.style.display = 'inline-block');
        usuarios.forEach(el => el.style.display = 'none');
    }
}

function configurarHamburguesa() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.getElementById('navMenu');
    if (hamburger && navMenu) {
        hamburger.addEventListener('click', () => navMenu.classList.toggle('active'));
    }
}

// Se ejecuta en todas las páginas
document.addEventListener('DOMContentLoaded', cargarYConfigurarNavbar);