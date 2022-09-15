const WebSocket = require('ws');
const port = 8080;
const wss = new WebSocket.Server({ port })
const clients = new Map();
const groups = new Map();
const genders = ['M', 'F'];
const countries = ['GR', 'FR', 'GE', 'IT', 'ES', 'TR', 'USA'];
const ages = ['18-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-60', '60<'];

wss.on('connection', function connection(ws) {
    const metadata = {
        id: uuidv4(),
        ws: ws,
        country: randomCountry(),
        gender: randomGender(),
        age: randomAge(18, 100),
        partnerAge: randomAgeGroup(),
        partnerGender: randomGender()
    }
    clients.set(metadata.id, metadata.ws);
    console.log('Clients: ' + clients.size);
    let ws_client = clients.get(metadata.id);
    let clientGroup = groupify(); // Group users based on country, gender and age. Returns group name.
    let partnerGroup = metadata.country + '_' + metadata.partnerGender + '_' + metadata.partnerAge;

    if (groups.get(partnerGroup) === undefined) {
        console.log("No users currently available, undefined");

        // On Close
        ws_client.on('close', () => {
            if (ws_client.readyState === WebSocket.OPEN) {
                ws_client.close();
            }
            clients.delete(metadata.id);
            groups.get(clientGroup).splice(groups.get(clientGroup).indexOf(metadata), 1);
        })

        return;
    } 

    console.log('Matches: ' + groups.get(partnerGroup).length);
    groups.get(partnerGroup).splice(groups.get(partnerGroup).indexOf(metadata), 1); // If client is also in partnerGroup, remove him to avoid be chosen as partner

    if (groups.get(partnerGroup).length < 1) {
        console.log("No users currently available");

        // On Close
        ws_client.on('close', () => {
            if (ws_client.readyState === WebSocket.OPEN) {
                ws_client.close();
            }
            clients.delete(metadata.id);
            groups.get(clientGroup).splice(groups.get(clientGroup).indexOf(metadata), 1);
        })

        return;
    }

    let randomPartner = groups.get(partnerGroup).splice(Math.floor(Math.random() * groups.get(partnerGroup).length), 1)[0]; // Select random user and remove him from the group

    if(randomPartner.id === metadata.id) { 
        console.log("Matched with self");

        // On Close
        ws_client.on('close', () => {
            if (ws_client.readyState === WebSocket.OPEN) {
                ws_client.close();
            }
            clients.delete(metadata.id);
            groups.get(clientGroup).splice(groups.get(clientGroup).indexOf(metadata), 1);
        })

        groups.get(partnerGroup).push(randomPartner);
        return;
    }

    let ws_partner = clients.get(randomPartner.id);
    // On Message
    ws_client.on('message', function idIncoming(data) {
        if (ws_client.readyState === WebSocket.OPEN && clients.has(randomPartner.id)) {
            ws_partner.send(data);    
        }
    })

    ws_partner.on('message', function partnerIncoming(data) {
        if (ws_partner.readyState === WebSocket.OPEN && clients.has(metadata.id)) {
            ws_client.send(data);
        }
    })

    // On Close
    ws_client.on('close', () => {
        if (ws_client.readyState === WebSocket.OPEN) {
            ws_client.close();
        }
        clients.delete(metadata.id);
        groups.get(clientGroup).splice(groups.get(clientGroup).indexOf(metadata), 1);
    })

    ws_partner.on('close', () => {
        if (clients.has(randomPartner.id)) {
            if (ws_partner.readyState === WebSocket.OPEN) {
                ws_partner.close();
            }
            clients.delete(randomPartner.id);
            groups.get(partnerGroup).splice(groups.get(partnerGroup).indexOf(randomPartner), 1);
        }
    })

    /**
     * Generates a group name based on country, gender and age. If group name already exists,
     * appends user at the particular group. Else, creates new group with new name and
     * instantiates with this user id.
     */
    function groupify() {
        let groupName = metadata.country + '_' + metadata.gender + '_';
        let value = metadata.age;
        switch (true) {
            case value >= 18 && value <= 24:
                groupName = groupName + ages[0];
                break;
            case value >= 25 && value <= 29:
                groupName = groupName + ages[1];
                break;
            case value >= 30 && value <= 34:
                groupName = groupName + ages[2];
                break;
            case value >= 35 && value <= 39:
                groupName = groupName + ages[3];
                break;
            case value >= 40 && value <= 44:
                groupName = groupName + ages[4];
                break;
            case value >= 45 && value <= 49:
                groupName = groupName + ages[5];
                break;
            case value >= 50 && value <= 59:
                groupName = groupName + ages[6];
                break;
            case value >= 60:
                groupName = groupName + ages[7];
                break;
        }

        if (groups.has(groupName)) {
            groups.get(groupName).push(metadata);
            return groupName;
        }

        groups.set(groupName, [metadata]);
        return groupName;
    }

})

// Helping functions
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function randomAge(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; };

function randomGender() { return genders[Math.floor(Math.random() * genders.length)]; };

function randomCountry() { return countries[Math.floor(Math.random() * countries.length)]; };

function randomAgeGroup() { return ages[Math.floor(Math.random() * ages.length)]; };

console.log('Server is running on port ' + port + '!');