import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject } from 'rxjs';
import { Socket, io } from 'socket.io-client';
import { environment } from '../../environment/environment';

export class WebsocketEvent {
  id: string;
  data: any;
}

@Injectable({
  providedIn: 'root'
})
export class WebsocketClientService {

  private socket: Socket;

  connected$: Observable<boolean>;
  private connectionSubject$: BehaviorSubject<boolean>;

  errors$: Observable<string>;
  private errorSubject$: Subject<string>;

  message$: Observable<WebsocketEvent>;
  private messageSubject$: BehaviorSubject<WebsocketEvent>;

  constructor() { 
    this.start();
  }

  start(): void {
    this.socket = io(this.getServicePath(), {
      transports: ['websocket'],
      reconnection: true,
      autoConnect: false,  // https://socket.io/docs/v4/client-options/#reconnectionattempts
    });

    this.connected$ = this.monitorConnection();
    this.errors$ = this.setupSocketErrorListener();
    this.message$ = this.listenMessage();
    this.socket.connect();
  }

  stop(): void {
    this.socket?.disconnect();
    this.messageSubject$?.complete();
    this.connectionSubject$?.complete();
    this.errorSubject$?.complete();
  }

  private getServicePath(): string {
    let path = `${environment.baseUrl}`;
    if (path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return path;
  }

  private monitorConnection(): Observable<boolean> {
    this.connectionSubject$ = new BehaviorSubject<boolean>(false);

    this.socket.on('connect', () => {
      this.connectionSubject$.next(true);
    });

    this.socket.on('connection', () => {
      this.connectionSubject$.next(true);
    });

    this.socket.on('disconnect', () => {
      this.connectionSubject$.next(false);
    });

    this.socket.on('disconnecting', () => {
      this.connectionSubject$.next(false);
    });

    return this.connectionSubject$.asObservable();
  }

  private setupSocketErrorListener(): Observable<string> {
    this.errorSubject$ = new Subject<string>();

    this.socket.on('error', (err: Error) => {
      this.errorSubject$.next('Error: ' + err);
    });

    this.socket.on('connect_error', (err: Error) => {
      this.errorSubject$.next('Connect Error: ' + err?.message);
    });

    this.socket.on('connect_timeout', (err: Error) => {
      this.errorSubject$.next('Connect Timeout: ' + err?.message);
    });

    this.socket.on('reconnect_error', () => {
      this.errorSubject$.next('Reconnect Error');
    });

    this.socket.on('reconnect_failed', () => {
      this.errorSubject$.next('Reconnect Failed');
    });

    return this.errorSubject$.asObservable();
  }

  private listenMessage(): Observable<WebsocketEvent> {
    this.messageSubject$?.complete();
    this.messageSubject$ = new BehaviorSubject<WebsocketEvent>(null);
    this.socket.on('message', (identifier: string, msg: string) => {
      this.messageSubject$.next({id: identifier, data: msg});
    });
    return this.messageSubject$.asObservable();
  }
}
