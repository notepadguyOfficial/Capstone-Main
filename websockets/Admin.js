const Logs = require('../utils/Logs');
const { db } = require('../config/database');

// #region Functions
async function GetDataCount(ws) {
    const [GetOnlineUsers, GetCustomersCount, GetWrsCount] = await Promise.all([
        db('authentication').count('userid as count').where({ online: 1 }).first(),
        db('Customer').count('customer_id as count').first(),
        db('water_refilling_station').count('station_id as count').first(),
    ]);

    const data = {
        OnlineCount: GetOnlineUsers.count,
        CustomerCount: GetCustomersCount.count,
        WRSCount: GetWrsCount.count
    };

    ws.send(JSON.stringify({ type: 'UserOnlineCount', data }));
}

// #endregion

// #region Handle

async function handle(ws, req, params) {
    const action = params.get('action');

    Logs.http(`Admin WebSocket connected with action: ${action}`);

    switch (action) {
        case 'GetDataCount':
            const interval = setInterval(() => GetDataCount(ws), 10000);
            GetDataCount(ws); // Initial push

            ws.on('close', async () => {
                clearInterval(interval);
                Logs.http('Admin WebSocket disconnected.');
                if (ws._server?.clients?.size === 0) {
                    await Stop([channels]);
                    Logs.http('Stopped listening to PostgreSQL because no clients are connected.');
                }
            });
            break;

        default:
            ws.send(JSON.stringify({ type: 'error', message: 'Unknown action for Admin' }));
            ws.close();
    }
}

// #endregion

module.exports = handle;