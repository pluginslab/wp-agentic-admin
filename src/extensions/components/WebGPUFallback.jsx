/**
 * WebGPU Fallback Component
 *
 * Displays a helpful message when WebGPU is not supported in the browser.
 *
 */

import { Notice, ExternalLink } from '@wordpress/components';

/**
 * WebGPUFallback component
 *
 * @param {Object} props        - Component props
 * @param {string} props.reason - The specific reason WebGPU isn't available
 */
const WebGPUFallback = ( { reason } ) => {
	return (
		<div className="wp-agentic-admin-webgpu-fallback">
			<Notice status="warning" isDismissible={ false }>
				<h3>WebGPU Not Available</h3>
				<p>
					<strong>Reason:</strong> { reason }
				</p>
				<p>
					Agentic Admin requires WebGPU to run AI models locally in
					your browser. WebGPU is a modern graphics API that enables
					high-performance machine learning.
				</p>
			</Notice>

			<div className="wp-agentic-admin-webgpu-fallback__help">
				<h4>How to Enable WebGPU</h4>

				<div className="wp-agentic-admin-browser-instructions">
					<div className="wp-agentic-admin-browser-card">
						<h5>Google Chrome (113+)</h5>
						<p>
							WebGPU is enabled by default in Chrome 113 and
							later.
						</p>
						<ol>
							<li>Update Chrome to the latest version</li>
							<li>
								Visit <code>chrome://gpu</code> to check WebGPU
								status
							</li>
							<li>
								If disabled, go to <code>chrome://flags</code>
							</li>
							<li>Search for &quot;WebGPU&quot; and enable it</li>
						</ol>
					</div>

					<div className="wp-agentic-admin-browser-card">
						<h5>Microsoft Edge (113+)</h5>
						<p>
							WebGPU is enabled by default in Edge 113 and later.
						</p>
						<ol>
							<li>Update Edge to the latest version</li>
							<li>
								Visit <code>edge://gpu</code> to check WebGPU
								status
							</li>
							<li>
								If disabled, go to <code>edge://flags</code>
							</li>
							<li>Search for &quot;WebGPU&quot; and enable it</li>
						</ol>
					</div>

					<div className="wp-agentic-admin-browser-card">
						<h5>Firefox (Nightly)</h5>
						<p>
							WebGPU is available in Firefox Nightly with a flag.
						</p>
						<ol>
							<li>Download Firefox Nightly</li>
							<li>
								Go to <code>about:config</code>
							</li>
							<li>
								Set <code>dom.webgpu.enabled</code> to{ ' ' }
								<code>true</code>
							</li>
							<li>Restart Firefox</li>
						</ol>
					</div>

					<div className="wp-agentic-admin-browser-card">
						<h5>Safari (18+)</h5>
						<p>WebGPU is available in Safari 18 on macOS Sonoma.</p>
						<ol>
							<li>Update to macOS Sonoma or later</li>
							<li>Update Safari to version 18+</li>
							<li>WebGPU should be enabled by default</li>
						</ol>
					</div>
				</div>

				<div className="wp-agentic-admin-webgpu-fallback__requirements">
					<h4>System Requirements</h4>
					<ul>
						<li>A modern GPU (integrated or dedicated)</li>
						<li>Up-to-date graphics drivers</li>
						<li>
							At least 4GB of available system RAM (8GB
							recommended)
						</li>
						<li>A WebGPU-compatible browser (see above)</li>
					</ul>
				</div>

				<div className="wp-agentic-admin-webgpu-fallback__alternatives">
					<h4>Alternative: Manual Abilities</h4>
					<p>
						While you won&apos;t be able to use the AI chat
						interface without WebGPU, you can still use the{ ' ' }
						<strong>Abilities</strong> tab to manually execute SRE
						tools like reading error logs, flushing cache, and
						checking site health.
					</p>
				</div>

				<div className="wp-agentic-admin-webgpu-fallback__links">
					<h4>Learn More</h4>
					<ul>
						<li>
							<ExternalLink href="https://caniuse.com/webgpu">
								WebGPU Browser Support (Can I Use)
							</ExternalLink>
						</li>
						<li>
							<ExternalLink href="https://developer.chrome.com/docs/web-platform/webgpu/">
								WebGPU Documentation (Chrome)
							</ExternalLink>
						</li>
						<li>
							<ExternalLink href="https://webgpureport.org/">
								WebGPU Report - Check Your Browser
							</ExternalLink>
						</li>
					</ul>
				</div>
			</div>
		</div>
	);
};

export default WebGPUFallback;
