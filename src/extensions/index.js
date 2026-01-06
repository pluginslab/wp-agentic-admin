/**
 * WP Neural Admin - Main Entry Point
 *
 * @package WPNeuralAdmin
 */

import { createRoot } from '@wordpress/element';
import App from './App';
import './styles/main.scss';

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('wp-neural-admin-root');

    if (!container) {
        return;
    }

    // Check if settings are available
    if (typeof window.wpNeuralAdmin === 'undefined') {
        console.error('WP Neural Admin: Settings not found');
        return;
    }

    const root = createRoot(container);
    root.render(<App />);
});
