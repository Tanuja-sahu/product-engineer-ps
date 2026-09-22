import {createMemoryStore} from './memoryStore.js'; import {createMongoStore} from './mongoStore.js';
export function createStore({mode=process.env.STORE_MODE||'mongo'}={}){return mode==='memory'?createMemoryStore():createMongoStore()}
