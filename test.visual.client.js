/**
 *	Redux-Cluster Test
 *	(c) 2018 by Siarhei Dudko.
 *
 *	standart test, include test Socket IPC and TCP (remote) client 
 *	LICENSE MIT
 */

"use strict"

var ReduxClusterWS = require('./client.js'),
	Cluster = require('cluster'),
	Lodash = require('lodash');

var Test = ReduxClusterWS.createStore(editProcessStorage);

if(Cluster.isMaster){
	Test.createWSClient({host: "http://localhost", port: 8888, login:"test2", password:'123456'});
}
	
function editProcessStorage(state = {version:''}, action){ 
	try {
		switch (action.type){
			case 'TASK':
				var state_new = Lodash.clone(state);
				state_new.version = action.payload.version;
				return state_new;
				break;
			default:
				break;
		}
	} catch(e){
	}
	var state_new = Lodash.clone(state);
	return state_new;
}

Test.subscribe(function(){
	if(Cluster.isMaster){
		var name = 'm';
	} else {
		var name = Cluster.worker.id;
	}
	console.log(' S1 | ' + name + ' | ' + JSON.stringify(Test.getState()));
});

if(Cluster.isMaster){
	for(var i=0; i < 2; i++){
		//setTimeout(function(){Cluster.fork();}, i*10000);
	}
	Test.dispatch({type:'TASK', payload: {version:'OneRemoteMasterTest0'}});
	var i = 0;
	setInterval(function(){
		Test.dispatch({type:'TASK', payload: {version:'OneRemoteMasterTest'+i}});
		i++;
	}, 1100);
} else {
	var i = 0;
	setInterval(function(){
		Test.dispatch({type:'TASK', payload: {version:'OneRemoteWorkerTest'+i}});
		i++;
	}, 2200+(Cluster.worker.id*1500), i);
}
