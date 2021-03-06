/*
 * Copyright (c) 2014 Samsung Electronics Co., Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
///<reference path='../ts-declarations/node.d.ts' />

///<reference path='./InstUtils.ts' />
///<reference path='./LastUseManager.ts' />

/**
 * Created by m.sridharan on 11/6/14.
 */
module ___LoggingAnalysis___ {

    export interface Logger {

        logDeclare(iid: number, name: string, objId: number): void
        logCreateObj(iid: number, objId: number): void
        // for the rare case with native objects when the create obj should have
        // a different sid than the current sid
        logCreateObjDiffScript(sid: number, iid: number, objId: number): void
        logCreateFun(iid: number, funEnterIID: number, objId: number): void
        logPutfield(iid: number, baseObjId: number, propName: string, valObjId: number): void
        logWrite(iid: number, name: string, objId: number): void
        // indicates that a block of last use entries is ending
        endLastUse(): void
        logLastUse(objId: number, timestamp: number, sourceId: string): void
        logFunctionEnter(iid: number, funObjId: number): void
        logFunctionExit(iid: number): void
        logUpdateIID(objId: number, newIID: number): void
        logDebug(callIID: number, objId: number): void
        logReturn(objId: number): void
        logCreateDOMNode(iid: number, objId: number): void
        logAddDOMChild(parentObjId: number, childObjId: number): void
        logRemoveDOMChild(parentObjId: number, childObjId: number): void
        logAddToChildSet(iid: number, parentObjId: number, name: string, childObjId: number): void
        logRemoveFromChildSet(iid: number, parentObjId: number, name: string, childObjId: number): void
        logDOMRoot(objId: number): void
        logCall(iid: number, funObjId: number, funEnterIID: number, funSID: number): void
        logScriptEnter(iid: number, scriptID: number, filename: string): void
        logScriptExit(iid: number): void
        // names is a string or an Array<string>
        logFreeVars(iid: number, names: any): void
        logSourceMapping(iid: number, startLine: number, startColumn: number, endLine: number, endColumn: number): void

        getTime(): number
        getFlushIID(): string
        setFlushIID(sourceFileId: number, iid: number): void
        stopTracing(): void
        end(cb: () => void): void
    }

    /**
     * useful for profiling other aspects of the system
     */
    class NullLogger implements Logger {
        logDeclare(iid:number, name:string, objId:number):void {
        }

        logCreateObj(iid:number, objId:number):void {
        }

        logCreateObjDiffScript(iid:number, objId:number):void {
        }

        logCreateFun(iid:number, funEnterIID:number, objId:number):void {
        }

        logPutfield(iid:number, baseObjId:number, propName:string, valObjId:number):void {
        }

        logWrite(iid:number, name:string, objId:number):void {
        }

        logLastUse(objId:number, timestamp:number, sourceId: string):void {
        }

        endLastUse(): void {}

        logFunctionEnter(iid:number, funObjId:number):void {
        }

        logFunctionExit(iid:number):void {
        }

        logUpdateIID(objId:number, newIID:number):void {
        }

        logDebug(callIID:number, objId:number):void {
        }

        logReturn(objId:number):void {
        }

        logCreateDOMNode(iid:number, objId:number):void {
        }

        logAddDOMChild(parentObjId:number, childObjId:number):void {
        }

        logRemoveDOMChild(parentObjId:number, childObjId:number):void {
        }

        logAddToChildSet(iid:number, parentObjId:number, name:string, childObjId:number):void {
        }

        logRemoveFromChildSet(iid:number, parentObjId:number, name:string, childObjId:number):void {
        }

        logDOMRoot(objId:number):void {
        }

        logCall(iid:number, funObjId:number, funEnterIID:number, funSID: number):void {
        }

        logScriptEnter(iid:number, scriptID: number, filename:string):void {
        }

        logScriptExit(iid:number):void {
        }

        logFreeVars(iid:number, names:any):void {
        }

        logSourceMapping(iid:number, startLine:number, startColumn:number, endLine: number, endColumn: number):void {
        }

        getTime():number {
            return undefined;
        }

        getFlushIID():string {
            return undefined;
        }

        setFlushIID(sourceFileId: number, iid:number):void {
        }

        stopTracing():void {
        }

        end(cb: () => void): void {

        }

    }

    // how often should we flush last use information?
    // TODO set up a setInterval() script that also flushes last use, so we flush when the application is idle
    var LAST_USE_FLUSH_PERIOD = 10000;

    /**
     * these are some handy utilities for any implementation of Logger to have.
     * this class doesn't implement the Logger interface since we can't actually
     * make it an abstract class.
     */
    class AbstractLogger {
        /**
         * time stamp of *previous* log entry
         */
        protected time:number = -1;

        lastUse: LastUseManager;
        /**
         * the time at which we most recently flushed last-use information
         * @type {number}
         */
        lastUseFlushTime:number = 0;
        /**
         * either the IID of the most recent top-level expression, or -1 if
         * we've already emitted a TOP_LEVEL_FLUSH for that most-recent expression
         * @type {number}
         */
        flushIID:string = ALREADY_FLUSHED;
        tracingStopped:boolean = false;

        /**
         * the script ID for the currently-executing script
         * @type {number}
         */
        currentScriptId: number = -1;

        constructor(lastUse: LastUseManager) {
            this.lastUse = lastUse;
        }

        getTime():number {
            return this.time;
        }

        setFlushIID(sourceFileId:number,iid:number):void {
            if (this.flushIID !== ALREADY_FLUSHED) {
                throw new Error("invalid flush IID value " + this.flushIID);
            }
            this.flushIID = sourceFileId + ':' + iid;
        }

        getFlushIID(): string {
            return this.flushIID;
        }
        stopTracing():void {
            this.tracingStopped = true;
        }

        /**
         * actions before logging an entry
         * @return true if logging should continue, false otherwise
         */
        protected beforeLog(fromLastUse?: boolean):boolean {
            if (this.tracingStopped) {
                return false;
            }
            var time = this.time;
            // the fromLastUse flag lets us avoid an infinite recursion
            if (time - this.lastUseFlushTime >= LAST_USE_FLUSH_PERIOD && !fromLastUse) {
                // time to flush our last use entries
                this.lastUse.flushLastUse();
                time = this.time;
                this.lastUseFlushTime = time;
            }
            // check if we need to update the current script
            var sid = J$.sid;
            if (sid !== this.currentScriptId) {
                this.currentScriptId = sid;
                this.logUpdateCurrentScript(sid);
                // metadata, so don't update the time
            }
            // check if we should log a top-level flush
            if (this.flushIID !== ALREADY_FLUSHED) {
                this.logTopLevelFlush(this.flushIID);
                time += 1;
                this.flushIID = ALREADY_FLUSHED;
            }
            // for the entry to be logged
            time += 1;
            this.time = time;
            return true;
        }

        protected logTopLevelFlush(slId: string): void {
            throw new Error("should be overridden by subclass!");
        }

        protected logUpdateCurrentScript(sid: number): void {
            throw new Error("should be overridden by subclass!");
        }
    }

    /**
     * logger that writes data using a fluent interface.
     * the fluent interface is implemented in subclasses,
     * defining the data format
     */
    class AbstractFluentLogger extends AbstractLogger implements Logger {

        ///////////////
        // fluent interface for writing out data
        ///////////////

        protected flushIfNeeded(nextRecordLength: number): AbstractFluentLogger {
            throw new Error("override in subclass!");
        }

        protected writeByte(val: number): AbstractFluentLogger {
            throw new Error("override in subclass!");
        }

        protected writeInt(val: number): AbstractFluentLogger {
            throw new Error("override in subclass!");
        }

        protected strLength(val: string): number {
            throw new Error("override in subclass!");
        }

        protected writeString(val: string): AbstractFluentLogger {
            throw new Error("override in subclass!");
        }

        private writeTypeAndIID(type: number, iid: number): AbstractFluentLogger {
            return this.writeByte(type).writeInt(iid);
        }


        logDeclare(iid:number, name:string, objId:number):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(1+3*4+this.strLength(name)).writeTypeAndIID(LogEntryType.DECLARE,iid)
                .writeString(name).writeInt(objId);
        }


        logCreateObj(iid:number, objId:number):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(1+2*4).writeTypeAndIID(LogEntryType.CREATE_OBJ,iid).writeInt(objId);
        }

        logCreateObjDiffScript(sid: number, iid: number, objId: number): void {
            if (!this.beforeLog()) return;
            // write an update script entry for the sid parameter, followed by the create obj entry,
            // followed by an update script entry back to the current script
            this.logUpdateCurrentScript(sid);
            this.flushIfNeeded(1+2*4).writeTypeAndIID(LogEntryType.CREATE_OBJ,iid).writeInt(objId);
            this.logUpdateCurrentScript(J$.sid);
        }

        logCreateFun(iid:number, funEnterIID:number, objId:number):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(1+3*4).writeTypeAndIID(LogEntryType.CREATE_FUN,iid)
                .writeInt(funEnterIID).writeInt(objId);
        }

        logPutfield(iid:number, baseObjId:number, propName:string, valObjId:number):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(1+4*4+this.strLength(propName)).writeTypeAndIID(LogEntryType.PUTFIELD,iid)
                .writeInt(baseObjId).writeString(propName).writeInt(valObjId);
        }

        logWrite(iid:number, name:string, objId:number):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(1+3*4+this.strLength(name)).writeTypeAndIID(LogEntryType.WRITE,iid)
                .writeString(name).writeInt(objId);
        }

        logLastUse(objId:number, timestamp:number, sourceId: string):void {
            if (!this.beforeLog(true)) return;
            this.flushIfNeeded(1+2*4+4+this.strLength(sourceId)).writeByte(LogEntryType.LAST_USE).writeInt(objId)
                .writeInt(timestamp).writeString(sourceId);
            // this shouldn't have incremented the time since it is metadata
            // so, subtract 1
            this.time--;
        }

        endLastUse(): void {
            this.flushIfNeeded(1).writeByte(LogEntryType.END_LAST_USE);
        }

        logFunctionEnter(iid:number, funObjId:number):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(1+2*4).writeTypeAndIID(LogEntryType.FUNCTION_ENTER,iid).writeInt(funObjId);
        }

        logFunctionExit(iid:number):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(5).writeTypeAndIID(LogEntryType.FUNCTION_EXIT,iid);
        }

        logUpdateIID(objId:number, newIID:number):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(1+2*4).writeByte(LogEntryType.UPDATE_IID).writeInt(objId).writeInt(newIID);
        }

        logDebug(callIID:number, objId:number):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(1+2*4).writeTypeAndIID(LogEntryType.DEBUG,callIID).writeInt(objId);
        }

        logReturn(objId:number):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(5).writeByte(LogEntryType.RETURN).writeInt(objId);
        }

        logCreateDOMNode(iid:number, objId:number):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(9).writeTypeAndIID(LogEntryType.CREATE_DOM_NODE,iid).writeInt(objId);
        }

        logAddDOMChild(parentObjId:number, childObjId:number):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(9).writeByte(LogEntryType.ADD_DOM_CHILD).writeInt(parentObjId).writeInt(childObjId);
        }

        logRemoveDOMChild(parentObjId:number, childObjId:number):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(9).writeByte(LogEntryType.REMOVE_DOM_CHILD).writeInt(parentObjId).writeInt(childObjId);
        }

        logAddToChildSet(iid:number, parentObjId:number, name:string, childObjId:number):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(1+4*4+this.strLength(name)).writeTypeAndIID(LogEntryType.ADD_TO_CHILD_SET,iid)
                .writeInt(parentObjId).writeString(name).writeInt(childObjId);
        }

        logRemoveFromChildSet(iid:number, parentObjId:number, name:string, childObjId:number):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(1+4*4+this.strLength(name)).writeTypeAndIID(LogEntryType.REMOVE_FROM_CHILD_SET,iid)
                .writeInt(parentObjId).writeString(name).writeInt(childObjId);
        }

        logDOMRoot(objId:number):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(5).writeByte(LogEntryType.DOM_ROOT).writeInt(objId);
        }

        logCall(iid:number, funObjId:number, funEnterIID:number, funSID: number):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(1+4*4).writeTypeAndIID(LogEntryType.CALL,iid).writeInt(funObjId).writeInt(funEnterIID)
                .writeInt(funSID);
        }

        logScriptEnter(iid:number, scriptID: number, filename:string):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(1+3*4+this.strLength(filename)).writeTypeAndIID(LogEntryType.SCRIPT_ENTER,iid)
                .writeInt(scriptID).writeString(filename);
        }

        logScriptExit(iid:number):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(5).writeTypeAndIID(LogEntryType.SCRIPT_EXIT,iid);
        }

        logFreeVars(iid:number, names:any):void {
            if (!this.beforeLog()) return;
            if (typeof names === 'string') {
                // we write -1 before the names to distinguish the case of the string ANY
                // from the array case
                this.flushIfNeeded(1+2*4+this.strLength(names)).writeTypeAndIID(LogEntryType.FREE_VARS,iid)
                    .writeInt(-1).writeString(names);
            } else { // names is an array of strings
                var arrayByteLength = 4; // for writing array length
                for (var i = 0; i < names.length; i++) {
                    arrayByteLength += 4+this.strLength(names[i]);
                }
                this.flushIfNeeded(1+4+arrayByteLength).writeTypeAndIID(LogEntryType.FREE_VARS,iid)
                    .writeInt(names.length);
                for (var i = 0; i < names.length; i++) {
                    this.writeString(names[i]);
                }
            }
            // this shouldn't have incremented the time since it is metadata
            // so, subtract 1
            this.time--;
        }

        logSourceMapping(iid:number, startLine:number, startColumn:number, endLine: number, endColumn: number):void {
            if (!this.beforeLog()) return;
            this.flushIfNeeded(5+4*4).writeTypeAndIID(LogEntryType.SOURCE_MAPPING,iid)
                .writeInt(startLine).writeInt(startColumn).writeInt(endLine).writeInt(endColumn);
            // this shouldn't have incremented the time since it is metadata
            // so, subtract 1
            this.time--;
        }

        protected logUpdateCurrentScript(scriptID: number): void {
            this.flushIfNeeded(5).writeTypeAndIID(LogEntryType.UPDATE_CURRENT_SCRIPT,scriptID);
        }

        protected logTopLevelFlush(slId: string): void {
            this.flushIfNeeded(1+4+this.strLength(slId)).writeByte(LogEntryType.TOP_LEVEL_FLUSH).writeString(slId);
        }

        end(cb:() => void): void {
            throw new Error("should be overridden by subclass!");
        }


    }

    var NODE_BUF_LENGTH = 65536;

    class AbstractNodeBufferLogger extends AbstractFluentLogger {

        private bufMod = require('../lib/analysis/bufferUtil.js');
        bufManager: any;

        constructor(lastUse: LastUseManager) {
            super(lastUse);
            this.bufManager = new this.bufMod.BufferManager(NODE_BUF_LENGTH);
        }

        flushIfNeeded(nextRecordLength:number):AbstractNodeBufferLogger {
            if (this.bufManager.offset + nextRecordLength > NODE_BUF_LENGTH) {
                this.flush();
            }
            return this;
        }

        writeByte(val:number):AbstractNodeBufferLogger {
            this.bufManager.writeByte(val);
            return this;
        }

        writeInt(val:number):AbstractNodeBufferLogger {
            this.bufManager.writeInt(val);
            return this;
        }

        strLength(val:string):number {
            return this.bufManager.strLength(val);
        }

        writeString(val:string):AbstractNodeBufferLogger {
            this.bufManager.writeString(val);
            return this;
        }

        protected flush():void {
            throw new Error("override in subclass!");
        }
    }

    export class BinaryFSLogger extends AbstractNodeBufferLogger {

        private fs = require('fs');
        private traceFh:number;

        constructor(lastUse: LastUseManager, traceLoc?: string) {
            super(lastUse);
            this.traceFh = this.fs.openSync(traceLoc ? traceLoc : "mem-trace", 'w');
        }


        protected flush(): void {
//            var time = process.hrtime();
            var bufMan = this.bufManager;
            this.fs.writeSync(this.traceFh, bufMan.buffer, 0, bufMan.offset);
//            var diff = process.hrtime(time);
//            totalFSTime += (diff[0] * 1e9 + diff[1]) / 1000000.0;
            bufMan.offset = 0;
        }

        end(cb:() => void): void {
            if (this.bufManager.offset > 0) {
                this.flush();
            }
            this.fs.closeSync(this.traceFh);
            console.log("done writing log");
            cb();
        }
    }

    export class AsciiFSLogger extends AbstractFluentLogger {

        private fs = require('fs');
        private traceFh:number;
        private buffer: String;

        constructor(lastUse: LastUseManager, traceLoc?: string) {
            super(lastUse);
            this.traceFh = this.fs.openSync(traceLoc ? traceLoc : "ascii-mem-trace", 'w');
            this.buffer = "";
        }

        flushIfNeeded(nextRecordLength:number):AsciiFSLogger {
            if (this.buffer.length > NODE_BUF_LENGTH) {
                this.flush();
            }
            return this;
        }

        writeByte(val:number):AsciiFSLogger {
            this.buffer += val + ',';
            return this;
        }

        writeInt(val:number):AsciiFSLogger {
            this.buffer += val + ',';
            return this;
        }

        strLength(val:string):number {
            return val.length;
        }

        writeString(val:string):AsciiFSLogger {
            this.buffer += val + ',';
            return this;
        }


        flush(): void {
//            var time = process.hrtime();
            this.fs.writeSync(this.traceFh, this.buffer);
//            var diff = process.hrtime(time);
//            totalFSTime += (diff[0] * 1e9 + diff[1]) / 1000000.0;
            this.buffer = "";
        }

        end(cb:() => void): void {
            if (this.buffer !== "") {
                this.flush();
            }
            this.fs.closeSync(this.traceFh);
            console.log("done writing log");
            cb();
        }
    }

    // to deal with monkey-patching; see NodeWebsocketLogger
    var ORIG_MATH_RANDOM  = Math.random;


    export class NodeWebSocketLogger extends AbstractNodeBufferLogger {

        private connection: any;

        private connectCB: () => void;

        private serverProc: any;
        constructor(lastUse: LastUseManager, appDir: string) {
            super(lastUse);
            if (!appDir) {
                throw new Error("appDir is undefined");
            }
            var WebSocketClient: any = require('websocket').client;
            var client = new WebSocketClient({
                fragmentOutgoingMessages: false
            });
            client.on('connect', (connection: any) => {
                this.connection = connection;
                this.connection.sendUTF('startup');
                if (this.connectCB) {
                    this.connectCB();
                }
            });
            var cp: any = require('child_process');
            var args: Array<string> = [
                require('path').resolve(__dirname, '../lib/server/server.js'),
                '--noHTTPServer',
                appDir

            ];
            var res = cp.spawn("node", args);
            res.on('error', (err: any) => {
                console.log("ERROR");
                console.log(err);
            });
            res.stdout.on('data', (chunk: any) => {
                // TODO fix this hack
                if (chunk.toString().indexOf("8080") !== -1) {
                    client.connect('ws://127.0.0.1:8080', 'mem-trace-protocol');
                }
            });
            res.stderr.on('data', (chunk: any) => {
                console.error(chunk.toString());
            });
            this.serverProc = res;
        }

        setConnectCB(connectCB: () => void) {
            if (this.connection) {
                connectCB();
            } else {
                this.connectCB = connectCB;
            }
        }

        flush(): void {
            var bufMan = this.bufManager;
            // YUCK: some benchmarks monkey-patch Math.random, which is used
            // by our WebSocket library.  So, temporarily un-monkey-patch it
            // here
            var backup_Math_random = Math.random;
            Math.random = ORIG_MATH_RANDOM;
            this.connection.sendBytes(bufMan.buffer.slice(0,bufMan.offset));
            Math.random = backup_Math_random;
            bufMan.offset = 0;
        }

        end(cb:() => void): void {
            if (this.bufManager.offset > 0) {
                this.flush();
            }
            this.connection.close();
            this.serverProc.on('exit', cb);
        }
    }

    export class BinaryWebSocketLogger extends AbstractFluentLogger {

        private buffer: ArrayBuffer = new ArrayBuffer(Constants.MAX_BUF_SIZE);

        private byteView = new Uint8Array(this.buffer);

        protected offset = 0;

        private socket:WebSocket;

        /**
         * is the socket open yet?
         * @type {boolean}
         */
        private isOpen = false;

        /**
         * buffer of messages that remain to be flushed over socket
         * @type {Array}
         */
        private remoteBuffer:Array<ArrayBuffer> = [];

        /**
         * if true, sent a message and waiting for an ack
         * @type {boolean}
         */
        private trying = false;

        /**
         * callback to invoke when all buffered trace flushed over socket
         */
        private cb:() => void;


        constructor(lastUse: LastUseManager) {
            super(lastUse);
            this.socket = new WebSocket('ws://127.0.0.1:8080', 'mem-trace-protocol');
            this.socket.onopen = () => {
                this.isOpen = true;
                this.socket.send('startup');
                this.flushRemoteBuffer();
            };
            this.socket.onmessage = () => {
                this.handleAck();
            };
        }

        /**
         * flushes one message from the remote buffer
         */
        private flushRemoteBuffer() {
            if (this.isOpen && !this.trying) {
                var remoteBuf = this.remoteBuffer;
                if (remoteBuf.length > 0) {
                    var contents = remoteBuf.shift();
                    this.socket.send(contents);
                    this.trying = true;
                }
            }
        }

        /**
         * handle ack message from server for previously-flushed message
         */
        private handleAck() {
            this.trying = false;
            if (this.remoteBuffer.length === 0) {
                if (this.cb) {
                    // first, close the socket since we are done
                    this.socket.close();
                    this.cb();
                }
            } else {
                this.flushRemoteBuffer();
            }
        }

        /**
         * flush current buffer to the socket via remoteBuffer
         */
        flush():void {
            // need the <any> cast since lib.d.ts doesn't have
            // ArrayBuffer.prototype.slice
            this.remoteBuffer.push((<any>this.buffer).slice(0,this.offset));
            this.flushRemoteBuffer();
            // the above call to slice() creates a copy, so we
            // don't need to allocate a fresh ArrayBuffer here
            this.offset = 0;
        }

        flushIfNeeded(nextRecordLength: number): BinaryWebSocketLogger {
            if (this.offset + nextRecordLength > Constants.MAX_BUF_SIZE) {
                this.flush();
            }
            return this;
        }

        writeByte(val: number): BinaryWebSocketLogger {
            var offset = this.offset;
            this.byteView[offset] = val;
            this.offset = offset+1;
            return this;
        }

        writeInt(val: number): BinaryWebSocketLogger {
            var offset = this.offset;
            var bv = this.byteView;
            bv[offset] = (val >>> 24);
            bv[offset + 1] = (val >>> 16);
            bv[offset + 2] = (val >>> 8);
            bv[offset + 3] = val;
            this.offset = offset+4;
            return this;
        }

        strLength(val: string): number {
            return val.length*2;
        }

        writeString(val: string): BinaryWebSocketLogger {
            var offset = this.offset;
            var bv = this.byteView;
            var strLen = this.strLength(val);
            bv[offset] = (strLen >>> 24);
            bv[offset + 1] = (strLen >>> 16);
            bv[offset + 2] = (strLen >>> 8);
            bv[offset + 3] = strLen;
            offset += 4;
            for (var i=0; i<val.length; i++) {
                // NOTE: this doesn't handle crazy 4-byte characters
                var charCode = val.charCodeAt(i);
                bv[offset++] = charCode;
                bv[offset++] = charCode >>> 8;
            }
            this.offset = offset;
            return this;
        }

        end(cb:() => void):void {
            if (this.offset > 0) {
                this.flush();
            }
            if (!this.trying) {
                cb();
            } else {
                this.cb = cb;
            }
        }


    }

    /**
     * useful for benchmarking other parts of system
     */
    class NoFlushWebSocketLogger extends BinaryWebSocketLogger {

        flush(): void {
            // don't really flush; just reset the offset
            this.offset = 0;
        }
    }
    // TODO revive this logger with support for binary data
//    class SyncAjaxLogger extends AbstractBufferingLogger {
//
//        constructor() {
//            super();
//            var request = new XMLHttpRequest();
//            request.open('POST', '__jalangi_startup__', false);
//            request.send(null);
//        }
//
//        flush(): void {
//            var request = new XMLHttpRequest();
//            request.open('POST', '__jalangi_mem_trace__', false);
//            request.send(this.buffer.join(''));
//            this.buffer = [];
//            this.bufferSize = 0;
//        }
//
//        end(cb:() => void):void {
//            if (this.buffer.length > 0) {
//                this.flush();
//            }
//            var request = new XMLHttpRequest();
//            request.open('POST', '__jalangi_close__', false);
//            request.send(null);
//            cb();
//        }
//    }



}
