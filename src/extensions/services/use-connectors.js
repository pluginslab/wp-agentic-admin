/**
 * Fetches the list of WP 7.0 AI Connectors via the plugin's REST endpoint
 * and re-fetches on demand. Used by the model provider picker.
 */

import { useState, useEffect, useCallback } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';

const useConnectors = () => {
	const [ connectors, setConnectors ] = useState( [] );
	const [ optionsUrl, setOptionsUrl ] = useState( '' );
	const [ supported, setSupported ] = useState( true );
	const [ loading, setLoading ] = useState( true );

	const load = useCallback( () => {
		setLoading( true );
		apiFetch( { path: '/wp-agentic-admin/v1/connectors' } )
			.then( ( res ) => {
				setConnectors( res.connectors || [] );
				setOptionsUrl( res.options_url || '' );
				setSupported( !! res.wp_supports_connectors );
			} )
			.catch( () => {
				setConnectors( [] );
			} )
			.finally( () => setLoading( false ) );
	}, [] );

	useEffect( () => {
		load();
	}, [ load ] );

	return { connectors, optionsUrl, supported, loading, refresh: load };
};

export default useConnectors;
