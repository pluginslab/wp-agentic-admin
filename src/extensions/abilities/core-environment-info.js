/**
 * Core Environment Info Ability
 *
 * Wraps WordPress core ability: core/get-environment-info
 * Returns runtime environment details for diagnostics.
 *
 * ABILITY OVERVIEW:
 * =================
 * This is a WordPress 6.9+ core ability that we provide a chat interface for.
 * No PHP registration needed - WordPress registers this automatically.
 * Demonstrates:
 * - Wrapping a core WordPress ability
 * - Formatting environment/system info for human readability
 * - Useful for diagnostics and troubleshooting
 *
 * PHP BACKEND RETURNS (WordPress Core):
 * {
 *   environment: "production",  // or "staging", "development", "local"
 *   php_version: "8.2.0",
 *   db_server_info: "MySQL 8.0.32",
 *   wp_version: "6.9.0"
 * }
 *
 * READ-ONLY: This ability only reads data, no confirmation needed.
 *
 * @package WPNeuralAdmin
 * @since 1.2.0
 * @see WordPress core: wp-includes/abilities.php
 */

import { registerAbility, executeAbility } from '../services/neural-abilities-api';

/**
 * Register the core/get-environment-info ability with the chat system.
 */
export function registerCoreEnvironmentInfo() {
    registerAbility('core/get-environment-info', {
        label: 'Get environment info',

        keywords: [
            'environment type',
            'what environment',
            'is this production',
            'is this staging',
            'is this development',
            'is this local',
            'wp_environment_type',
            'runtime environment',
        ],

        initialMessage: 'Fetching environment information...',

        /**
         * Generate summary from the result.
         *
         * @param {Object} result - The result from WordPress core.
         * @return {string} Human-readable summary.
         */
        summarize: (result) => {
            if (!result || typeof result !== 'object') {
                return 'Unable to retrieve environment information.';
            }

            const lines = [];

            if (result.environment) {
                const envDisplay = result.environment.charAt(0).toUpperCase() + result.environment.slice(1);
                lines.push(`**Environment:** ${envDisplay}`);
            }
            if (result.wp_version) {
                lines.push(`**WordPress Version:** ${result.wp_version}`);
            }
            if (result.php_version) {
                lines.push(`**PHP Version:** ${result.php_version}`);
            }
            if (result.db_server_info) {
                lines.push(`**Database:** ${result.db_server_info}`);
            }

            if (lines.length === 0) {
                return 'Environment information retrieved but no data available.';
            }

            return lines.join('\n');
        },

        /**
         * Execute the ability.
         *
         * @param {Object} params - Parameters from the chat system.
         * @return {Promise<Object>} The result from WordPress core.
         */
        execute: async (params) => {
            // core/get-environment-info doesn't accept parameters
            return executeAbility('core/get-environment-info', {});
        },

        /**
         * Parse user intent to extract parameters.
         *
         * @param {string} message - The user's message.
         * @return {Object} Extracted parameters.
         */
        parseIntent: (message) => {
            // No parameters to parse for this ability
            return {};
        },

        // Read-only operation - no confirmation needed.
        requiresConfirmation: false,
    });
}

export default registerCoreEnvironmentInfo;
