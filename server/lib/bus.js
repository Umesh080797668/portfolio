'use strict';

const { EventEmitter } = require('events');

/** Tiny in-process pub/sub that tells open tracking streams "order X changed". */
function createBus() {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    return {
        publish(orderId) {
            if (orderId) emitter.emit(`order:${orderId}`);
        },
        subscribe(orderId, handler) {
            const name = `order:${orderId}`;
            emitter.on(name, handler);
            return () => emitter.off(name, handler);
        }
    };
}

module.exports = { createBus };
