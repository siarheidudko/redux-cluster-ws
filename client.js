/**
 *	Redux-Cluster-WS
 *	(c) 2018 by Siarhei Dudko.
 *
 *	Websocket (socket.io) Client wrapper for redux-cluster
 *	LICENSE MIT
 */
 
 "use strict"
 
var Crypto = require('crypto-browserify'),
	SocketIOClient = require('socket.io-client'),
	Redux = require('redux'),
	Lodash = require('lodash');
	 
var ReduxClusterModule = {};	//модуль
Object.assign(ReduxClusterModule, Redux);	//копирую свойства Redux
var reducers = {}; //список редьюсеров (хэш собирается по имени редьюсера для совместимости различных ОС, т.к. hasher(<function>.toString()) для разных ос дает разные суммы)

//хэширование паролей
function hasher(data){
	if(typeof(data) === 'string'){
		const hash = Crypto.createHash('sha1');
		hash.update(data);
		return(hash.digest('hex'));
	} else 
		return;
}

//функция замены "." на "_" и обратно
function replacer(data_val, value_val){
	if(typeof(data_val) === 'string'){
		if(value_val){
			return data_val.replace(/\./gi,"_");
		} else {
			return data_val.replace(/\_/gi,".");
		}
	}
}

function ReduxCluster(_reducer){
	let self = this;
	self.stderr = console.error;	//callback для ошибок
	self.role = [];		//роль
	self.mode = "action";	//тип синхронизации по умолчанию
	self.connected = true;		//статус соединения
	self.resync = 1000;		//количество действий для пересинхронизации
	self.RCHash = hasher(_reducer.name);	//создаю метку текущего редьюсера для каждого экземпляра
	self.version = require('./package.json').version;	//версия пакета
	self.homepage = require('./package.json').homepage;	//домашняя страница пакета
	self.altReducer = _reducer;	//оригинальный редьюсер
	if(typeof(reducers[_reducer.name]) === 'undefined'){
		reducers[_reducer.name] = self.RCHash;
	} else {
		throw new Error("Please don't use a reducer with the same name!");
	}
	try{
		let _d = self.altReducer(undefined, {});	//получаю значение state при старте
		if(typeof(_d) === 'object'){
			self.defaulstate = _d;
		} else {
			throw new Error('The returned value is not an object.');
		}
	} catch(e){
		self.defaulstate = {};
	};
	self.newReducer = function(state=self.defaulstate, action){	//собственный редьюсер
		if (action.type === 'REDUX_CLUSTER_SYNC'){
			let state_new = Lodash.clone(action.payload);
			return state_new;
		} else { 
			return self.altReducer(state, action);
		}
	}
	Object.assign(self, Redux.createStore(self.newReducer));	//создаю хранилище с собственным редьюсером
	delete self.replaceReducer;	//удаляю замену редьюсера
}

function createWSClient(store, config){	//функция создания клиента
	let self = this;
	if(typeof(config) !== 'object'){
		throw new Error('Argument requires configuration object!');
	} else if(typeof(config.host) !== 'string') {
		throw new Error('Config requires server address!');
	} else if((typeof(config.port) !== 'string') && (typeof(config.port) !== 'number')) {
		config.port = 10002;
	} else if(typeof(config.login) !== 'string') {
		throw new Error('Config requires login for server authorization!');
	} else if(typeof(config.password) !== 'string') {
		throw new Error('Config requires password for server authorization!');
	}
	self.store = store;
	self.store.dispatchNEW = self.store.dispatch;	//переопределяю dispatch
	delete self.store.dispatch;
	self.config = Object.assign(config);
	self.login = hasher("REDUX_CLUSTER"+self.config.login);
	self.password = hasher("REDUX_CLUSTER"+self.config.password);
	self.reconnect = function(){
		try {
			let socket;
			if(self.config.host.toLowerCase().indexOf('https://') !== -1){
				socket = new SocketIOClient.connect(self.config.host + ':' + self.config.port, { secure: true, transports: ['websocket']});
			} else {
				socket = new SocketIOClient.connect(self.config.host + ':' + self.config.port, {transports: ['websocket']});
			}
			self.socket = socket;
			socket.on('connect_error', (error) => {
				if(error.description && error.description.message){
					let err = error.description;
					self.store.stderr('ReduxCluster.createWSClient connect error: '+error.message+' ->'+err.message);
				} else {
					self.store.stderr('ReduxCluster.createWSClient connect error: '+error.message);
				}
			});
			socket.on('error', (error) => {
				if(error.description && error.description.message){
					let err = error.description;
					self.store.stderr('ReduxCluster.createWSClient client error: '+error.message+' ->'+err.message);
				} else {
					self.store.stderr('ReduxCluster.createWSClient client error: '+error.message);
				}
			});
			socket.on('connect', () => {
				socket.emit('RCMSG', {_msg:'REDUX_CLUSTER_SOCKET_AUTH', _hash:self.store.RCHash, _login:self.login, _password:self.password});	//авторизация в сокете
			});
			socket.on('RCMSG', function (data) {
				if(data._hash === self.store.RCHash){
					switch(data._msg){
						case 'REDUX_CLUSTER_MSGTOWORKER':
							self.store.dispatchNEW(data._action);
							break;
						case 'REDUX_CLUSTER_SOCKET_AUTHSTATE':
							if(data._value === true){
								socket.emit('RCMSG', {_msg:'REDUX_CLUSTER_START', _hash:self.store.RCHash});	//синхронизирую хранилище
								self.store.connected = true;
							}else{
								if(data._banned)
									socket.disconnect(new Error('your ip is locked for 3 hours'));
								else
									socket.disconnect(new Error('authorization failed'));
							}
							break;
					}
				}	
			});
		} catch(err){
			self.store.stderr('ReduxCluster.createWSClient client error: '+err.message)
			self.store.connected = false;
			setTimeout(self.reconnect, 10000);
		}
	};
	self.store.dispatch = function(_data){
		try{
			self.socket.emit('RCMSG', {_msg:'REDUX_CLUSTER_MSGTOMASTER', _hash:self.store.RCHash, _action:_data});
		} catch(err){
			self.store.stderr('ReduxCluster.createWSClient write error: '+err.message);
		}
	}
	self.reconnect();
}

function createStore(_reducer){		//функция создания хранилища
	let _ReduxCluster = new ReduxCluster(_reducer);		//создаю экземпляр хранилища
	_ReduxCluster.createWSClient = function(_settings){	//подключаю объект создания клиента
		if(_ReduxCluster.role.indexOf("client") === -1) { _ReduxCluster.role.push("client"); }
		_ReduxCluster.connected = false;
		return new createWSClient(_ReduxCluster, _settings);
	}
	return _ReduxCluster;
}

ReduxClusterModule.createStore = createStore; 	//переопределяю функцию создания хранилища

ReduxClusterModule.functions = {
	replacer: replacer,
	hasher: hasher,
};

module.exports = ReduxClusterModule;