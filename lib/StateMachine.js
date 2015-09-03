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



var ne = require( './ne.js' ) ;



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
	this.stateStack = [ { name: 'init' } ] ;
	this.offset = 0 ;
} ;



StateMachine.prototype.pushEvent = function pushEvent( event , hostContext )
{
	var i , iMax , state , programState , eventList , switched , loop ;
	
	state = this.stateStack[ 0 ] ;
	programState = this.program.states[ state.name ] ;
	
	loop = true ;
	
	while ( loop )
	{
		loop = false ;
		eventList = programState.event ;
		iMax = eventList.length ;
		
		for ( i = 0 ; i < iMax ; i ++ )
		{
			if (
				eventList[ i ].trigger === true ||
				( typeof eventList[ i ].trigger === 'string' && eventList[ i ].trigger === event ) ||
				( eventList[ i ].trigger instanceof RegExp && event.search( eventList[ i ].trigger ) !== -1 )
			)
			{
				// Update the state?
				if ( eventList[ i ].state && eventList[ i ].state !== state.name )
				{
					switched = true ;
					state = this.stateStack[ 0 ] = { name: eventList[ i ].state } ;
					programState = this.program.states[ state.name ] ;
					
					if ( programState.buffer )
					{
						state.buffer = '' ;
						state.bufferStartingContext = hostContext ;
					}
				}
				
				if ( programState.buffer )
				{
					state.buffer += event ;
				}
				
				// Exec the switching state action now, if any...
				if ( eventList[ i ].action )
				{
					if ( this.hostMethods[ eventList[ i ].action[ 0 ] ] )
					{
						this.hostMethods[ eventList[ i ].action[ 0 ] ].apply( hostContext , eventList[ i ].action.slice( 1 ) ) ;
					}
				}
				
				// Propagate now?
				loop = switched && eventList[ i ].propagate ;
				
				break ;
			}
		}
	}
	
	
	// Exec the finishing state action, if any...
	if ( programState.action )
	{
		if ( this.hostMethods[ programState.action[ 0 ] ] )
		{
			this.hostMethods[ programState.action[ 0 ] ].apply( hostContext , programState.action.slice( 1 ) ) ;
		}
	}
} ;





