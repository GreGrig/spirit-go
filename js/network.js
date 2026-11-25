window.SpiritGo = window.SpiritGo || {};

(function (ns) {
  class NetworkManager {
    constructor(onMessage, onStatusChange) {
      this.peer = null;
      this.conn = null;
      this.role = null;
      this.onMessage = onMessage;
      this.onStatusChange = onStatusChange;
    }

    disconnect() {
      if (this.conn) { try { this.conn.close(); } catch (e) {} this.conn = null; }
      if (this.peer) { try { this.peer.destroy(); } catch (e) {} this.peer = null; }
      this.role = null;
    }

    createRoom(onCodeReady) {
      this.disconnect();
      if (typeof Peer === 'undefined') {
        this.onStatusChange('⚠️ Ошибка: библиотека PeerJS не загрузилась (проверьте интернет).');
        return;
      }
      this.role = 'host';
      const shortCode = String(Math.floor(1000 + Math.random() * 9000));
      const fullId = `spiritgo-room-${shortCode}`;

      this.onStatusChange('Подключение к облаку PeerJS...');
      this.peer = new Peer(fullId);

      this.peer.on('open', () => {
        onCodeReady(shortCode);
        this.onStatusChange(`Комната создана! Передайте код ${shortCode} другу и ждите подключения...`);
      });

      this.peer.on('connection', (connection) => {
        this.conn = connection;
        this._setupConnection();
      });

      this.peer.on('error', (err) => {
        this.onStatusChange(`⚠️ Сетевая ошибка: ${err.type}`);
      });
    }

    joinRoom(shortCode) {
      this.disconnect();
      if (typeof Peer === 'undefined') {
        this.onStatusChange('⚠️ Ошибка: библиотека PeerJS не загрузилась (проверьте интернет).');
        return;
      }
      const cleanCode = String(shortCode).trim();
      if (cleanCode.length !== 4) {
        this.onStatusChange('⚠️ Введите 4-значный код комнаты.');
        return;
      }
      this.role = 'guest';
      this.onStatusChange(`Подключение к комнате ${cleanCode}...`);
      this.peer = new Peer();

      this.peer.on('open', () => {
        this.conn = this.peer.connect(`spiritgo-room-${cleanCode}`, { reliable: true });
        this._setupConnection();
      });

      this.peer.on('error', (err) => {
        if (err.type === 'peer-unavailable') {
          this.onStatusChange('❌ Комната с таким кодом не найдена.');
        } else {
          this.onStatusChange(`⚠️ Сетевая ошибка: ${err.type}`);
        }
      });
    }

    _setupConnection() {
      this.conn.on('open', () => {
        this.onStatusChange('✅ Соперник подключился! Запуск матча...');
        this.onMessage({ type: 'CONNECTED', role: this.role });
      });

      this.conn.on('data', (data) => {
        if (data && typeof data === 'object') {
          this.onMessage(data);
        }
      });

      this.conn.on('close', () => {
        this.onStatusChange('🔌 Соперник отключился от партии.');
        this.onMessage({ type: 'DISCONNECTED' });
      });
    }

    send(payload) {
      if (this.conn && this.conn.open) {
        this.conn.send(payload);
      }
    }

    isConnected() {
      return Boolean(this.conn && this.conn.open);
    }
  }

  ns.NetworkManager = NetworkManager;
})(window.SpiritGo);