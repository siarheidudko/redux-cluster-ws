/**
 *	Redux-Cluster-WS
 *	(c) 2018 by Siarhei Dudko.
 *
 *	Websocket (socket.io) Server wrapper for redux-cluster
 *	LICENSE MIT
 */
 
 "use strict"

var Http = require('http'),
	Https = require('https'),
	SocketIO = require('socket.io'),
	Fs = require('fs'),
	Crypto = require('crypto'),
	ReduxCluster = require('redux-cluster');

function ReduxClusterWsWrapper(store){
	let self = this;
	self.store = store;		//постоянная ссылка на магазин
	self.uid = ReduxCluster.functions.generateUID();
	self.ip2ban = {};	//база данных блокнутых ip
	self.ip2banTimeout = 10800000;
	self.database = {};	//база данных авторизации
	self.sockets = {};	//авторизованные сокеты
	self.timeout = 30000;
	self.config = {host: '0.0.0.0', port: 10002};	//дефолтные настройки сервера
	if((store instanceof ReduxCluster.createStore))	{	//проверяю переданный объект
		throw new Error('Argument requires redux-cluster store!');
	} else if (store.version < '1.5'){
		throw new Error('Please update you redux-cluster library up to version 1.5.0 or great! '+self.store.homepage);
	}
	store.createWSServer = function(config){
		self.ip2banGCStart = setInterval(function(){
			for(const key in self.ip2ban){
				if((self.ip2ban[key].time+self.ip2banTimeout) < Date.now()){
					delete self.ip2ban[key];
				}
			}
		}, 60000);
		self.ip2banGCStop = function(){ clearInterval(self.ip2banGCStart); }
		self.sendtoall = function(_message){
			if(self.io instanceof SocketIO){
				if(typeof(_message) === 'object'){
					for(const uid in self.sockets){
						try{
							if(self.sockets[uid] && (typeof(self.sockets[uid].emit) === 'function'))
								self.sockets[uid].emit("RCMSG", _message);
						} catch(err){
							self.store.stderr('ReduxCluster.createWSServer write error: '+err.message);
						}
					}
				} else {
					for(const uid in self.sockets){
						try{
							if(self.sockets[uid] && (typeof(self.sockets[uid].emit) === 'function'))
								self.sockets[uid].emit("RCMSG", {_msg:"REDUX_CLUSTER_MSGTOWORKER", _hash:self.store.RCHash, _action:{type:"REDUX_CLUSTER_SYNC", payload:self.store.getState()}});
						} catch(err){
							self.store.stderr('ReduxCluster.createWSServer write error: '+err.message);
						}
					}
				}
			}
		}
		self.unsubscribe = self.store.subscribe(function(){	//подписываю сокет на изменения Redux только в режиме snapshot
			if(self.store.mode === "snapshot")
				self.sendtoall();
		});
		self.store.allsock[self.uid] = self;
		if(self.store.role.indexOf("server") === -1) { self.store.role.push("server"); }
		if(typeof(config) === 'object'){
			self.config = Object.assign(config);
		}
		if(typeof(self.config.logins) === 'object')
			for(const login in self.config.logins){ self.database[ReduxCluster.functions.hasher("REDUX_CLUSTER"+login)] = ReduxCluster.functions.hasher("REDUX_CLUSTER"+self.config.logins[login]); }
		if(typeof(self.config.server) === 'undefined'){
			if(self.config.ssl && self.config.ssl.crt && self.config.ssl.ca && self.config.ssl.key){	//формирую сертификат сервера
				self.ssl = {
					key: ''+Fs.readFileSync(self.config.ssl.key),
					cert: Fs.readFileSync(self.config.ssl.crt) + '\n' + Fs.readFileSync(self.config.ssl.ca)
				};
			}
			if(self.ssl){
				self.server = new Https.createServer(ssl, undefined).setTimeout(self.timeout).listen(self.config.port, self.config.host);
				self.io = new SocketIO(self.server, { log: true ,pingTimeout: 7200000, pingInterval: 25000, secure:true, transports: ['websocket'], path: "/redux-cluster-"+self.store.RCHash});
			} else{
				self.server = new Http.createServer(undefined).setTimeout(self.timeout).listen(self.config.port, self.config.host);
				self.io = new SocketIO(self.server, { log: true ,pingTimeout: 7200000, pingInterval: 25000, transports: ['websocket'], path: "/redux-cluster-"+self.store.RCHash});
			}
		} else if (self.config.server instanceof Http.Server){
			self.server = self.config.server;
			self.io = new SocketIO(self.server, { log: true ,pingTimeout: 7200000, pingInterval: 25000, transports: ['websocket'], path: "/redux-cluster-"+self.store.RCHash});
		} else if (self.config.server instanceof Https.Server){
			self.server = self.config.server;
			self.io = new SocketIO(self.server, { log: true ,pingTimeout: 7200000, pingInterval: 25000, secure:true, transports: ['websocket'], path: "/redux-cluster-"+self.store.RCHash});
		} else {
			throw new Error('Server instanse is not supported library! Please use http/https native library.');
		}
		self.io.engine.generateId = ReduxCluster.functions.generateUID;
		self.io.sockets.on('connection', function (socket) {
			try{
				let thisSocketAddressArr = self.io.sockets.sockets[socket.id].handshake.address.split(':');
				let _i2bTest = ReduxCluster.functions.replacer(thisSocketAddressArr[thisSocketAddressArr.length-1], true);
				if((typeof(_i2bTest) === 'undefined') || (typeof(self.ip2ban[_i2bTest]) === 'undefined') || ((typeof(self.ip2ban[_i2bTest]) === 'object') && ((self.ip2ban[_i2bTest].count < 5) || ((self.ip2ban[_i2bTest].time+self.ip2banTimeout) < Date.now())))){
					socket.on('RCMSG', function(data){
						if(data._hash === self.store.RCHash){	//проверяю что сообщение привязано к текущему хранилищу
							switch(data._msg){
								case 'REDUX_CLUSTER_MSGTOMASTER': 	//получаю диспатчер от клиента
									if((typeof(socket.id) !== 'undefined') && (typeof(self.sockets[socket.id]) !== 'undefined')){
										if(data._action.type === 'REDUX_CLUSTER_SYNC')
											throw new Error("Please don't use REDUX_CLUSTER_SYNC action type!");
										self.store.dispatch(data._action);
									}
									break;
								case 'REDUX_CLUSTER_START':	//получаю метку, что клиент запущен
									if((typeof(socket.id) !== 'undefined') && (typeof(self.sockets[socket.id]) !== 'undefined')){
										self.sockets[socket.id].emit('RCMSG', {_msg:"REDUX_CLUSTER_MSGTOWORKER", _hash:self.store.RCHash, _action:{type:"REDUX_CLUSTER_SYNC", payload:self.store.getState()}});
									}
									break;
								case 'REDUX_CLUSTER_SOCKET_AUTH':
									if( (typeof(data._login) !== 'undefined') && 
										(typeof(data._password) !== 'undefined') &&
										(typeof(self.database[data._login]) !== 'undefined') && 
										(self.database[data._login] === data._password)){
										   self.sockets[socket.id] = socket;
										   if((typeof(_i2bTest) === 'string') && (typeof(self.ip2ban[_i2bTest]) === 'object')) { delete self.ip2ban[_i2bTest]; } //если логин присутствует в таблице забаненных удаляю
										   self.sockets[socket.id].emit('RCMSG', {_msg:"REDUX_CLUSTER_SOCKET_AUTHSTATE", _hash:self.store.RCHash, _value:true});
									} else {
										if(typeof(_i2bTest) === 'string') { 
											let _tempCount = 0;
											if(typeof(self.ip2ban[_i2bTest]) === 'object'){ 
												_tempCount = self.ip2ban[_i2bTest].count; 
												if(_tempCount >= 5) { _tempCount = 0; } //по таймауту сбрасываю счетчик попыток
											}
											self.ip2ban[_i2bTest] = {time: Date.now(), count:_tempCount+1}; 
										}
										socket.emit('RCMSG', {_msg:"REDUX_CLUSTER_SOCKET_AUTHSTATE", _hash:self.store.RCHash, _value:false});
										if(typeof(socket.disconnect) === 'function'){
											socket.disconnect();
										}
										if((typeof(socket.id) !== 'undefined') && (typeof(self.sockets[socket.id]) !== 'undefined')){
											delete self.sockets[socket.id];
										}
									}
									break;
							}
						}
					});
				} else {
					socket.emit('RCMSG', {_msg:"REDUX_CLUSTER_SOCKET_AUTHSTATE", _hash:self.store.RCHash, _value:false, _banned: true});
					if(typeof(socket.disconnect) === 'function'){
						socket.disconnect();
					}
					if((typeof(socket.id) !== 'undefined') && (typeof(self.sockets[socket.id]) !== 'undefined')){
						delete self.sockets[socket.id];
					}
				}
			} catch(err){
				self.store.stderr('ReduxCluster.createWSServer socket error: '+err.message);
				if(typeof(socket.disconnect) === 'function'){
					socket.disconnect();
				}
			}
			socket.on('error', function(err){
				self.store.stderr('ReduxCluster.createWSServer read error: '+err.message);
			});
		});
	}
};

module.exports = function(store){ 
	new ReduxClusterWsWrapper(store);
	return store;
};