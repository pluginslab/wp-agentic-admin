/**
 * FeedbackTab Component
 *
 * Settings and status panel for the response-feedback feature.
 * Lets users opt in or out of thumbs-up / thumbs-down rating, and shows
 * a summary of ratings collected so far (stored locally in the browser).
 *
 */

import { useState, useEffect } from '@wordpress/element';
import {
	getFeedbackOptIn,
	setFeedbackOptIn,
	getAllFeedback,
} from '../services/feedback';

/**
 * A single stat card
 *
 * @param {Object} props       - Component props
 * @param {string} props.value - Large number / value to display
 * @param {string} props.label - Description below the value
 * @param {string} props.mod   - BEM modifier for colour
 * @return {JSX.Element} Rendered stat card
 */
const StatCard = ( { value, label, mod = '' } ) => (
	<div
		className={ `wp-agentic-feedback__stat ${
			mod ? `wp-agentic-feedback__stat--${ mod }` : ''
		}` }
	>
		<span className="wp-agentic-feedback__stat-value">{ value }</span>
		<span className="wp-agentic-feedback__stat-label">{ label }</span>
	</div>
);

/**
 * FeedbackTab component
 *
 * @return {JSX.Element} Rendered feedback settings tab
 */
const FeedbackTab = () => {
	const [ optIn, setOptInState ] = useState( () => getFeedbackOptIn() );
	const [ saving, setSaving ] = useState( false );
	const [ entries, setEntries ] = useState( [] );

	useEffect( () => {
		setEntries( getAllFeedback() );
	}, [] );

	const thumbsUp = entries.filter( ( e ) => e.rating === 'up' ).length;
	const thumbsDown = entries.filter( ( e ) => e.rating === 'down' ).length;
	const total = entries.length;

	/**
	 * Toggle the opt-in state and persist to server.
	 *
	 * @param {boolean} newValue - New opt-in value
	 */
	const handleToggle = async ( newValue ) => {
		setSaving( true );
		setOptInState( newValue );
		await setFeedbackOptIn( newValue );
		setSaving( false );
	};

	return (
		<div className="wp-agentic-feedback">
			{ /* ── Header ── */ }
			<div className="wp-agentic-feedback__header">
				<h3 className="wp-agentic-feedback__title">
					Response Feedback
				</h3>
				<p className="wp-agentic-feedback__intro">
					Rate AI responses with a thumbs up or down after each reply.
					Feedback helps you track where the assistant performs well
					and where it struggles — entirely within your browser.{ ' ' }
					<strong>No data is ever sent to external servers.</strong>
				</p>
			</div>

			{ /* ── Opt-in toggle card ── */ }
			<div className="wp-agentic-feedback__card">
				<div className="wp-agentic-feedback__card-body">
					<div className="wp-agentic-feedback__toggle-row">
						<div className="wp-agentic-feedback__toggle-info">
							<span className="wp-agentic-feedback__toggle-title">
								Enable response ratings
							</span>
							<span className="wp-agentic-feedback__toggle-desc">
								Shows 👍 / 👎 buttons below each assistant
								reply.
							</span>
						</div>
						<button
							type="button"
							className={ `wp-agentic-feedback__toggle ${
								optIn ? 'wp-agentic-feedback__toggle--on' : ''
							}` }
							onClick={ () => handleToggle( ! optIn ) }
							disabled={ saving }
							aria-pressed={ !! optIn }
							aria-label="Enable response ratings"
						>
							<span className="wp-agentic-feedback__toggle-knob" />
						</button>
					</div>

					<p
						className={ `wp-agentic-feedback__status ${
							optIn
								? 'wp-agentic-feedback__status--on'
								: 'wp-agentic-feedback__status--off'
						}` }
					>
						{ /* eslint-disable-next-line no-nested-ternary -- clear three-state status message */ }
						{ saving
							? 'Saving…'
							: optIn
							? 'Ratings are enabled. Thumbs icons appear on each assistant response.'
							: 'Ratings are disabled. Enable to start collecting response feedback.' }
					</p>
				</div>
			</div>

			{ /* ── Stats ── */ }
			{ optIn && (
				<div className="wp-agentic-feedback__card">
					<h4 className="wp-agentic-feedback__card-title">
						Collected ratings
					</h4>
					<div className="wp-agentic-feedback__stats">
						<StatCard value={ total } label="Total rated" />
						<StatCard
							value={ thumbsUp }
							label="Thumbs up"
							mod="up"
						/>
						<StatCard
							value={ thumbsDown }
							label="Thumbs down"
							mod="down"
						/>
						{ total > 0 && (
							<StatCard
								value={ `${ Math.round(
									( thumbsUp / total ) * 100
								) }%` }
								label="Positive"
								mod="pct"
							/>
						) }
					</div>
					{ total === 0 && (
						<p className="wp-agentic-feedback__empty">
							No ratings yet. Rate responses in the Chat tab to
							see results here.
						</p>
					) }
				</div>
			) }

			{ /* ── Privacy note ── */ }
			<div className="wp-agentic-feedback__privacy">
				<svg
					width="14"
					height="14"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					aria-hidden="true"
				>
					<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
				</svg>
				<span>
					Ratings are stored only in your browser&apos;s local
					storage. They are never transmitted to Pluginslab,
					WordPress.org, or any third party.
				</span>
			</div>
		</div>
	);
};

export default FeedbackTab;
