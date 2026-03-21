/**
 * FeedbackOptInBanner Component
 *
 * Shown once when the user has not yet decided whether to enable response feedback.
 * All collected feedback stays in localStorage — nothing leaves the browser.
 *
 */

/**
 * FeedbackOptInBanner component
 *
 * @param {Object}   props           - Component props
 * @param {Function} props.onAccept  - Called when the user opts in
 * @param {Function} props.onDecline - Called when the user declines
 * @return {JSX.Element} Rendered banner
 */
const FeedbackOptInBanner = ( { onAccept, onDecline } ) => {
	return (
		<div className="agentic-feedback-banner">
			<div className="agentic-feedback-banner__body">
				<span
					className="agentic-feedback-banner__icon"
					aria-hidden="true"
				>
					<svg
						width="16"
						height="16"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
					>
						<path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
						<path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
					</svg>
				</span>
				<p className="agentic-feedback-banner__text">
					Would you like to rate responses with a thumbs up or down?{ ' ' }
					<span className="agentic-feedback-banner__note">
						Feedback stays in your browser — nothing is sent
						externally.
					</span>
				</p>
			</div>
			<div className="agentic-feedback-banner__actions">
				<button
					type="button"
					className="agentic-feedback-banner__btn agentic-feedback-banner__btn--accept"
					onClick={ onAccept }
				>
					Yes, enable
				</button>
				<button
					type="button"
					className="agentic-feedback-banner__btn agentic-feedback-banner__btn--decline"
					onClick={ onDecline }
				>
					No thanks
				</button>
			</div>
		</div>
	);
};

export default FeedbackOptInBanner;
