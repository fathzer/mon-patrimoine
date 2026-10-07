export class EventBus<EventMap extends Record<string, unknown> = Record<string, unknown>> {
  private listeners: { [K in keyof EventMap]?: Array<(data: EventMap[K]) => void> } = {};

  on<K extends keyof EventMap>(event: K, callback: (data: EventMap[K]) => void): void {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event]!.push(callback);
  }

  emit<K extends keyof EventMap>(event: K, data: EventMap[K]): void {
    if (this.listeners[event]) {
      this.listeners[event]!.forEach(cb => cb(data));
    }
  }
}
