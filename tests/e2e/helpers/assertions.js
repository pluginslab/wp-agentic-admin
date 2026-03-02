/**
 * Assertion Engine for E2E Tests
 *
 * Provides assertion functions that evaluate ReAct agent results
 * from the test hook (window.__wpAgenticTestHook).
 *
 * @since 2.0.0
 */

/**
 * Run all assertions for a test case against actual results
 *
 * @param {Object} assertions - Expected assertions from the test definition
 * @param {Object} actual     - Actual results from the test hook
 * @param {Object} actual.toolsUsed    - Array of tool IDs called
 * @param {Object} actual.observations - Array of tool results
 * @param {string} actual.lastMessage  - Last DOM message text
 * @return {Object} Result with pass/fail status and details
 */
export function runAssertions( assertions, actual ) {
	const results = [];
	let allPassed = true;

	// toolsCalled: exact tools expected (order-insensitive by default)
	if ( assertions.toolsCalled ) {
		const expected = [ ...assertions.toolsCalled ].sort();
		const got = [ ...( actual.toolsUsed || [] ) ].sort();
		const pass = JSON.stringify( expected ) === JSON.stringify( got );
		results.push( {
			type: 'toolsCalled',
			pass,
			expected,
			got,
			message: pass
				? `Tools match: ${ expected.join( ', ' ) }`
				: `Expected tools [${ expected.join( ', ' ) }] but got [${ got.join( ', ' ) }]`,
		} );
		if ( ! pass ) {
			allPassed = false;
		}
	}

	// toolsCalledExactly: exact count
	if ( assertions.toolsCalledExactly !== undefined ) {
		const count = ( actual.toolsUsed || [] ).length;
		const pass = count === assertions.toolsCalledExactly;
		results.push( {
			type: 'toolsCalledExactly',
			pass,
			expected: assertions.toolsCalledExactly,
			got: count,
			message: pass
				? `Tool count matches: ${ count }`
				: `Expected exactly ${ assertions.toolsCalledExactly } tool(s) but got ${ count }`,
		} );
		if ( ! pass ) {
			allPassed = false;
		}
	}

	// toolsCalledMinimum: minimum count
	if ( assertions.toolsCalledMinimum !== undefined ) {
		const count = ( actual.toolsUsed || [] ).length;
		const pass = count >= assertions.toolsCalledMinimum;
		results.push( {
			type: 'toolsCalledMinimum',
			pass,
			expected: `>= ${ assertions.toolsCalledMinimum }`,
			got: count,
			message: pass
				? `Tool count ${ count } >= ${ assertions.toolsCalledMinimum }`
				: `Expected at least ${ assertions.toolsCalledMinimum } tool(s) but got ${ count }`,
		} );
		if ( ! pass ) {
			allPassed = false;
		}
	}

	// toolsCalledMaximum: maximum count
	if ( assertions.toolsCalledMaximum !== undefined ) {
		const count = ( actual.toolsUsed || [] ).length;
		const pass = count <= assertions.toolsCalledMaximum;
		results.push( {
			type: 'toolsCalledMaximum',
			pass,
			expected: `<= ${ assertions.toolsCalledMaximum }`,
			got: count,
			message: pass
				? `Tool count ${ count } <= ${ assertions.toolsCalledMaximum }`
				: `Expected at most ${ assertions.toolsCalledMaximum } tool(s) but got ${ count }`,
		} );
		if ( ! pass ) {
			allPassed = false;
		}
	}

	// toolsCalledInOrder: tools must appear in the specified order
	if ( assertions.toolsCalledInOrder && assertions.toolsCalled ) {
		const expected = assertions.toolsCalled;
		const got = actual.toolsUsed || [];
		let orderCorrect = true;
		let lastIndex = -1;

		for ( const tool of expected ) {
			const idx = got.indexOf( tool, lastIndex + 1 );
			if ( idx === -1 || idx <= lastIndex ) {
				orderCorrect = false;
				break;
			}
			lastIndex = idx;
		}

		results.push( {
			type: 'toolsCalledInOrder',
			pass: orderCorrect,
			expected,
			got,
			message: orderCorrect
				? 'Tools called in correct order'
				: `Tools not in expected order. Expected [${ expected.join( ' → ' ) }] but got [${ got.join( ' → ' ) }]`,
		} );
		if ( ! orderCorrect ) {
			allPassed = false;
		}
	}

	// noToolsCalled: conversational mode (no tools should be called)
	if ( assertions.noToolsCalled ) {
		const count = ( actual.toolsUsed || [] ).length;
		const pass = count === 0;
		results.push( {
			type: 'noToolsCalled',
			pass,
			expected: 0,
			got: count,
			message: pass
				? 'No tools called (conversational mode)'
				: `Expected no tools but ${ count } were called: ${ ( actual.toolsUsed || [] ).join( ', ' ) }`,
		} );
		if ( ! pass ) {
			allPassed = false;
		}
	}

	// responseContains: all keywords must be present in the response
	if ( assertions.responseContains ) {
		const response = ( actual.lastMessage || '' ).toLowerCase();
		const missing = assertions.responseContains.filter(
			( kw ) => ! response.includes( kw.toLowerCase() )
		);
		const pass = missing.length === 0;
		results.push( {
			type: 'responseContains',
			pass,
			expected: assertions.responseContains,
			got: missing.length === 0 ? 'All found' : `Missing: ${ missing.join( ', ' ) }`,
			message: pass
				? 'Response contains all expected keywords'
				: `Response missing keywords: ${ missing.join( ', ' ) }`,
		} );
		if ( ! pass ) {
			allPassed = false;
		}
	}

	// responseContainsAny: at least one keyword must be present
	if ( assertions.responseContainsAny ) {
		const response = ( actual.lastMessage || '' ).toLowerCase();
		const found = assertions.responseContainsAny.filter( ( kw ) =>
			response.includes( kw.toLowerCase() )
		);
		const pass = found.length > 0;
		results.push( {
			type: 'responseContainsAny',
			pass,
			expected: assertions.responseContainsAny,
			got: found.length > 0 ? `Found: ${ found.join( ', ' ) }` : 'None found',
			message: pass
				? `Response contains: ${ found.join( ', ' ) }`
				: `Response missing all of: ${ assertions.responseContainsAny.join( ', ' ) }`,
		} );
		if ( ! pass ) {
			allPassed = false;
		}
	}

	// responseNotEmpty: response must have non-trivial content
	if ( assertions.responseNotEmpty ) {
		const response = ( actual.lastMessage || '' ).trim();
		const pass = response.length > 10;
		results.push( {
			type: 'responseNotEmpty',
			pass,
			expected: '> 10 chars',
			got: `${ response.length } chars`,
			message: pass
				? 'Response is non-empty'
				: 'Response is empty or too short',
		} );
		if ( ! pass ) {
			allPassed = false;
		}
	}

	// conditionalAssertions: L3 conditional logic
	if ( assertions.conditionalAssertions ) {
		for ( const cond of assertions.conditionalAssertions ) {
			const observations = actual.observations || [];

			// Check if the condition tool was called and returned expected data
			const condObs = observations.find( ( o ) => o.tool === cond.ifTool );
			if ( ! condObs ) {
				results.push( {
					type: 'conditionalAssertion',
					pass: false,
					expected: `Tool ${ cond.ifTool } to be called`,
					got: 'Not called',
					message: `Condition tool ${ cond.ifTool } was not called`,
				} );
				allPassed = false;
				continue;
			}

			// Check if the condition matches
			const resultStr = JSON.stringify( condObs.result );
			const conditionMet = cond.ifContains
				? resultStr.toLowerCase().includes( cond.ifContains.toLowerCase() )
				: true;

			if ( conditionMet && cond.thenExpectTool ) {
				const toolWasCalled = ( actual.toolsUsed || [] ).includes( cond.thenExpectTool );
				results.push( {
					type: 'conditionalAssertion',
					pass: toolWasCalled,
					expected: `${ cond.thenExpectTool } after ${ cond.ifTool } returned "${ cond.ifContains }"`,
					got: toolWasCalled ? 'Called' : 'Not called',
					message: toolWasCalled
						? `Conditional: ${ cond.thenExpectTool } correctly called after condition met`
						: `Conditional: ${ cond.thenExpectTool } should have been called after ${ cond.ifTool } returned "${ cond.ifContains }"`,
				} );
				if ( ! toolWasCalled ) {
					allPassed = false;
				}
			}
		}
	}

	return {
		passed: allPassed,
		results,
		summary: `${ results.filter( ( r ) => r.pass ).length }/${ results.length } assertions passed`,
	};
}

export default { runAssertions };
