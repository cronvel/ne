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



StateMachine.create = function create( options )
{
	var stateMachine = Object.create( StateMachine.prototype , {
		program: { value: require( './stateMachineProgram.js' ) , enumerable: true , writable: true } ,
		hostMethods: { value: options.hostMethods || {} , enumerable: true , writable: true } ,
		offset: { value: 0 , enumerable: true , writable: true } ,
		stateStack: { value: [] , enumerable: true , writable: true } ,
		savedStateStack: { value: [] , enumerable: true , writable: true } ,
	} ) ;
	
	stateMachine.reset() ;
	
	return stateMachine ;
} ;



StateMachine.prototype.reset = function reset()
{
	this.stateStack = [ {
		name: this.program.config.initState || 'init'
	} ] ;
	
	this.offset = 0 ;
} ;



StateMachine.prototype.pushEvent = function pushEvent( event , hostContext )
{
	var state , programBuffer , programState , programEvent ,
		delayedAction , switched , oldState , primaryContext , altContext , actionBuffer , errorAction , loop ;
	
	state = this.stateStack[ 0 ] ;
	programState = this.program.states[ state.name ] ;
	delayedAction = false ;
	
	loop = true ;
	
	while ( loop )
	{
		loop = false ;
		
		programEvent = triggeringItem( programState.event , event ) ;
		
		if ( programEvent )
		{
			primaryContext = state.hostContext ;
			altContext = state.startingHostContext ;
			errorAction = undefined ;
			actionBuffer = undefined ;
			
			// Update the state?
			if (
				( programEvent.state && programEvent.state !== state.name ) ||
				( programEvent.return && this.stateStack.length > 1 )
			)
			{
				switched = true ;
				
				programBuffer = triggeringItem( programState.buffer , state.buffer ) ;
				
				if ( programBuffer )
				{
					actionBuffer = state.buffer ;
					programEvent = fastShallowExtend( programEvent , programBuffer ) ;
				}
				
				if ( programEvent.delay )
				{
					delayedAction = programState.action ;
				}
				
				
				oldState = state ;
				
				// Update to the new state
				if ( programEvent.return && this.stateStack.length > 1 )
				{
					this.stateStack.shift() ;
					state = this.stateStack[ 0 ] ;
					programState = this.program.states[ state.name ] ;
					altContext = state.enteringHostContext ;
					
					if ( typeof programEvent.return === 'string' && programEvent.return !== state.enteringState )
					{
						// We are returning from an unexpected subProgram
						if ( programEvent.errorAction ) { errorAction = programEvent.errorAction ; }	// jshint ignore:line
					}
				}
				else
				{
					if ( programEvent.return )
					{
						// We are in a state where we cannot return
						if ( programEvent.errorAction ) { errorAction = programEvent.errorAction ; }	// jshint ignore:line
					}
					
					programState = this.program.states[ programEvent.state ] ;
					
					if ( programState.subProgram )
					{
						// Save the entering context
						state.enteringHostContext = hostContext ;
						state.enteringState = programEvent.state ;
						
						state = {
							name: programEvent.state ,
							hostContext: hostContext
						} ;
						
						this.stateStack.unshift( state ) ;
					}
					else
					{
						state = this.stateStack[ 0 ] = {
							name: programEvent.state ,
							previousName: state.name ,
							hostContext: hostContext ,
							previousHostContext: state.hostContext
						} ;
					}
					
					state.startingHostContext = programEvent.continue ? oldState.startingHostContext : hostContext ;
					
					if ( programState.buffer )
					{
						state.buffer = programEvent.preserveBuffer ? oldState.buffer + event : event ;
					}
				}
			}
			else
			{
				state.previousName = state.name ;
				state.previousHostContext = state.hostContext ;
				state.hostContext = hostContext ;
				
				if ( programState.buffer )
				{
					state.buffer += event ;
				}
			}
			
			// Exec the switching state action now, if any...
			if ( errorAction )
			{
				this.execAction( errorAction , primaryContext , altContext , actionBuffer ) ;
			}
			else if ( programEvent.action )
			{
				this.execAction( programEvent.action , primaryContext , altContext , actionBuffer ) ;
			}
			
			// Propagate now?
			loop = switched && programEvent.propagate ;
		}
	}
	
	
	// Exec the finishing state action, if any...
	if ( delayedAction !== false ) { this.execAction( delayedAction , hostContext ) ; }
	else if ( programState.action ) { this.execAction( programState.action , hostContext ) ; }
} ;



function triggeringItem( items , str )
{
	if ( ! items || typeof items !== 'object' ) { return ; }
	
	var i , iMax = items.length ;
	
	for ( i = 0 ; i < iMax ; i ++ )
	{
		if (
			items[ i ].trigger === true ||
			( typeof items[ i ].trigger === 'string' && items[ i ].trigger === str ) ||
			( Array.isArray( items[ i ].trigger ) && items[ i ].trigger.indexOf( str ) !== -1 ) ||
			( items[ i ].trigger instanceof RegExp && str.search( items[ i ].trigger ) !== -1 ) ||
			( typeof items[ i ].trigger === 'function' && items[ i ].trigger( str ) )
		)
		{
			return items[ i ] ;
		}
	}
}



StateMachine.prototype.execAction = function execAction( action , hostContext , altHostContext , buffer )
{
	var i , iMax ;
	
	if ( Array.isArray( action[ 0 ] ) )
	{
		// This is an array of array, it contains many actions to execute
		iMax = action.length ;
		for ( i = 0 ; i < iMax ; i ++ ) { this.execAction( action[ i ] , hostContext , altHostContext , buffer ) ; }
		return ;
	}
	
	if ( this.hostMethods[ action[ 0 ] ] )
	{
		hostContext.alt = altHostContext ;
		hostContext.buffer = buffer ;
		this.hostMethods[ action[ 0 ] ].apply( hostContext , action.slice( 1 ) ) ;
	}
} ;



function fastShallowExtend()
{
	var k ,
		i = 0 , iMax = arguments.length ,
		extendedObject = {} , currentObject ;
	
	for ( ; i < iMax ; i ++ )
	{
		currentObject = arguments[ i ] ;
		for ( k in currentObject ) { extendedObject[ k ] = currentObject[ k ] ; }
	}
	
	return extendedObject ;
}

