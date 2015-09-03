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
	var state , programBuffer , programState , programEvent , switched , loop ;
	
	state = this.stateStack[ 0 ] ;
	programState = this.program.states[ state.name ] ;
	
	loop = true ;
	
	while ( loop )
	{
		loop = false ;
		
		programEvent = triggeringItem( programState.event , event ) ;
		
		if ( programEvent )
		{
			// Update the state?
			if ( programEvent.state && programEvent.state !== state.name )
			{
				switched = true ;
				
				programBuffer = programState.buffer && triggeringItem( programState.buffer , state.buffer ) ;
				
				if ( programBuffer )
				{
					// Exec the buffer action now, before anything, if any...
					if ( programBuffer.action )
					{
						this.execAction( programBuffer.action , state.hostContext , state.bufferStartingHostContext ) ;
					}
				}
				
				state = this.stateStack[ 0 ] = {
					name: programEvent.state ,
					previousName: state.name ,
					hostContext: hostContext ,
					previousHostContext: state.hostContext
				} ;
				
				programState = this.program.states[ state.name ] ;
				
				if ( programState.buffer )
				{
					state.buffer = event ;
					state.bufferStartingHostContext = hostContext ;
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
			if ( programEvent.action ) { this.execAction( programEvent.action , hostContext ) ; }
			
			// Propagate now?
			loop = switched && programEvent.propagate ;
		}
	}
	
	
	// Exec the finishing state action, if any...
	if ( programState.action ) { this.execAction( programState.action , hostContext ) ; }
} ;



function triggeringItem( items , str )
{
	var i , iMax = items.length ;
	
	for ( i = 0 ; i < iMax ; i ++ )
	{
		if (
			items[ i ].trigger === true ||
			( typeof items[ i ].trigger === 'string' && items[ i ].trigger === str ) ||
			( items[ i ].trigger instanceof RegExp && str.search( items[ i ].trigger ) !== -1 )
		)
		{
			return items[ i ] ;
		}
	}
}



StateMachine.prototype.execAction = function execAction( action , hostContext , altHostContext )
{
	if ( this.hostMethods[ action[ 0 ] ] )
	{
		hostContext.alt = altHostContext ;
		this.hostMethods[ action[ 0 ] ].apply( hostContext , action.slice( 1 ) ) ;
	}
} ;




