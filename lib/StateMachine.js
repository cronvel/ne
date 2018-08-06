/*
	The Cedric's Swiss Knife (CSK) - Neon

	Copyright (c) 2015 Cédric Ronvel

	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/

"use strict" ;



/*
	Optimization ideas:
		* save states at different point in the buffer
		* when something changes, resume the StateMachine at the closest previous saved state
		* if the state machine pass to a checkpoint where the saved state has not changed, it is stopped
*/

function StateMachine() { throw new Error( "Use StateMachine.create() instead." ) ; }
module.exports = StateMachine ;



StateMachine.create = function create( options ) {
	var stateMachine = Object.create( StateMachine.prototype , {
		program: { value: require( './stateMachineProgram.js' ) , enumerable: true , writable: true } ,
		hostMethods: { value: options.hostMethods || {} , enumerable: true , writable: true } ,
		offset: { value: 0 , enumerable: true , writable: true } ,
		stateStack: { value: [] , enumerable: true , writable: true } ,
		savedStateStack: { value: [] , enumerable: true , writable: true }
	} ) ;

	stateMachine.reset() ;

	return stateMachine ;
} ;



StateMachine.prototype.reset = function reset() {
	this.stateStack = [ {
		name: this.program.config.initState || 'init'
	} ] ;

	this.offset = 0 ;
} ;



StateMachine.prototype.pushEvent = function pushEvent( event , hostContext ) {
	var currentState , bufferProgram , stateProgram , eventProgram ,
		delayedAction , stateHasSwitched = false , oldState , primaryContext , altContext , actionBuffer , errorAction ;

	// Get the current state
	currentState = this.stateStack[ this.stateStack.length - 1 ] ;
	
	// Active state program
	stateProgram = this.program.states[ currentState.name ] ;
	
	delayedAction = false ;

	for ( ;; ) {
		eventProgram = this.eventProgramMatch( stateProgram.events , event ) ;

		if ( ! eventProgram ) { break ; }
		
		primaryContext = currentState.hostContext ;
		altContext = currentState.startingHostContext ;
		errorAction = undefined ;
		actionBuffer = undefined ;

		// Check for state switching
		if (
			( eventProgram.state && eventProgram.state !== currentState.name ) ||
			( eventProgram.return && this.stateStack.length > 1 )
		) {
			stateHasSwitched = true ;

			bufferProgram = this.eventProgramMatch( stateProgram.buffer , currentState.buffer ) ;

			if ( bufferProgram ) {
				actionBuffer = currentState.buffer ;
				eventProgram = Object.assign( {} , eventProgram , bufferProgram ) ;
			}

			if ( eventProgram.delay ) {
				delayedAction = stateProgram.action ;
			}


			oldState = currentState ;

			// Update to the new state
			if ( eventProgram.return && this.stateStack.length > 1 ) {
				this.stateStack.pop() ;
				currentState = this.stateStack[ this.stateStack.length - 1 ] ;
				stateProgram = this.program.states[ currentState.name ] ;
				altContext = currentState.enteringHostContext ;

				if ( typeof eventProgram.return === 'string' && eventProgram.return !== currentState.enteringState ) {
					// We are returning from an unexpected subProgram
					if ( eventProgram.errorAction ) { errorAction = eventProgram.errorAction ; }
				}
			}
			else {
				if ( eventProgram.return ) {
					// We are in a state where we cannot return
					if ( eventProgram.errorAction ) { errorAction = eventProgram.errorAction ; }
				}

				stateProgram = this.program.states[ eventProgram.state ] ;

				if ( stateProgram.subProgram ) {
					// Save the entering context
					currentState.enteringHostContext = hostContext ;
					currentState.enteringState = eventProgram.state ;

					currentState = {
						name: eventProgram.state ,
						hostContext: hostContext
					} ;

					this.stateStack.push( currentState ) ;
				}
				else {
					currentState = this.stateStack[ this.stateStack.length - 1 ] = {
						name: eventProgram.state ,
						previousName: currentState.name ,
						hostContext: hostContext ,
						previousHostContext: currentState.hostContext
					} ;
				}

				currentState.startingHostContext = eventProgram.continue ? oldState.startingHostContext : hostContext ;

				if ( stateProgram.buffer ) {
					currentState.buffer = eventProgram.preserveBuffer ? oldState.buffer + event : event ;
				}
			}
		}
		else {
			currentState.previousName = currentState.name ;
			currentState.previousHostContext = currentState.hostContext ;
			currentState.hostContext = hostContext ;

			if ( stateProgram.buffer ) {
				currentState.buffer += event ;
			}
		}

		// Exec the switching state action now, if any...
		if ( errorAction ) {
			this.execAction( errorAction , primaryContext , altContext , actionBuffer ) ;
		}
		else if ( eventProgram.action ) {
			this.execAction( eventProgram.action , primaryContext , altContext , actionBuffer ) ;
		}

		// Propagate now?
		if ( ! stateHasSwitched || ! eventProgram.propagate ) { break ; }
	}


	// Exec the finishing state action, if any...
	if ( delayedAction !== false ) { this.execAction( delayedAction , hostContext ) ; }
	else if ( stateProgram.action ) { this.execAction( stateProgram.action , hostContext ) ; }
} ;



// Get the first matching eventProgram
StateMachine.prototype.eventProgramMatch = function eventProgramMatch( eventPrograms , event ) {
	if ( ! Array.isArray( eventPrograms ) ) { return ; }

	var eventProgram , i , iMax = eventPrograms.length ;

	for ( i = 0 ; i < iMax ; i ++ ) {
		eventProgram = eventPrograms[ i ] ;
		
		if (
			// Always match
			eventProgram.trigger === true ||
			
			// Equality
			( typeof eventProgram.trigger === 'string' && eventProgram.trigger === event ) ||
			
			// Included in an array of string
			( Array.isArray( eventProgram.trigger ) && eventProgram.trigger.includes( event ) ) ||
			
			// Match a RegExp
			( eventProgram.trigger instanceof RegExp && eventProgram.trigger.test( event ) ) ||
			
			// Third party function
			( typeof eventProgram.trigger === 'function' && eventProgram.trigger( event ) )
		) {
			return eventProgram ;
		}
	}
}



StateMachine.prototype.execAction = function execAction( action , hostContext , altHostContext , buffer ) {
	if ( Array.isArray( action[ 0 ] ) ) {
		// This is an array of array, it contains many actions to execute
		action.forEach( action_ => this.execAction( action_ , hostContext , altHostContext , buffer ) ) ;
		return ;
	}

	if ( this.hostMethods[ action[ 0 ] ] ) {
		hostContext.altContext = altHostContext ;
		hostContext.buffer = buffer ;
		
		if ( ! Array.isArray( action[ 1 ] ) ) {
			// Pack action's argument once
			action[ 1 ] = action.slice( 1 ) ;
		}
		
		this.hostMethods[ action[ 0 ] ]( hostContext , ... action[ 1 ] ) ;
	}
} ;

