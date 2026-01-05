const dgram = require('dgram');
const os = require('os');

const EL_Multi6 = 'ff02::1';
const sock6 = dgram.createSocket({ type: 'udp6', reuseAddr: true });

// Find a usable IPv6 interface (en0 is typical on Mac)
const ifaces = os.networkInterfaces();
let targetIfName = 'en0';
let ifAddrWithScope = null;
let ifAddrNoScope = null;

if (ifaces[targetIfName]) {
    for (const addr of ifaces[targetIfName]) {
        if (addr.family === 'IPv6' && addr.address.startsWith('fe80')) {
            ifAddrWithScope = addr.address; // e.g., fe80::xxxx:xxxx:xxxx:xxxx%en0
            if (addr.address.includes('%')) {
                ifAddrNoScope = addr.address.split('%')[0];
            } else {
                ifAddrNoScope = addr.address;
                // Manually add scope if missing for testing (though os.networkInterfaces usually includes it on Mac)
                // But usually checking raw output showed it didn't always have % in the string property?
                // Let's rely on what we saw in test-network.js: "address": "fe80::1cc3:3812:efc6:1613" (NO %) but "scopeid": 14
                // Wait, looking back at Step 34 output:
                // "address": "fe80::1cc3:3812:efc6:1613", "scopeid": 14.
                // It does NOT have % in the address field string in Node 18+ json output?
                // Let's check if the library logic `includes('%')` even triggers.
            }
            break;
        }
    }
}

console.log('Target Interface:', targetIfName);
console.log('Address from OS:', ifAddrWithScope);

sock6.bind(3610, '::', () => {
    console.log('Socket bound');

    // Test 1: Try adding membership with pure address (no scope ID string)
    // If the OS returned address has no %, this is just the address.
    console.log(`\nTest 1: addMembership(Multi6, "${ifAddrNoScope}")`);
    try {
        sock6.addMembership(EL_Multi6, ifAddrNoScope);
        console.log('SUCCESS: addMembership without scope string passed.');
    } catch (e) {
        console.error('FAILED: addMembership without scope string:', e.message);
    }

    // Test 2: Try adding membership with explicit scope suffix %en0
    // dgram.addMembership docs say: "The multicastInterface must be a valid string representation of an IP address..."
    // "On some systems, it is necessary to specify the interface..."

    const addrWithSuffix = ifAddrNoScope + '%' + targetIfName;
    console.log(`\nTest 2: addMembership(Multi6, "${addrWithSuffix}")`);
    try {
        sock6.addMembership(EL_Multi6, addrWithSuffix);
        console.log('SUCCESS: addMembership WITH scope string passed.');
    } catch (e) {
        console.error('FAILED: addMembership WITH scope string:', e.message);
    }

    sock6.close();
});
