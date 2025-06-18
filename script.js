
const socket = io(); // Changed from io('https://blipchat.onrender.com')

const form = document.getElementById('form');
const input = document.getElementById('m');
const messages = document.getElementById('messages');
const roomList = document.getElementById('room-list');
const currentRoomDisplay = document.getElementById('current-room-display');

// --- Global state for current room and username ---
let username = null;
let currentRoom = 'Room 1'; // Changed default room to 'Room 1'
let clientId = null;

// --- Room names for client-side logic ---
const ROOM_NAMES = {
    ROOM1: 'Room 1',
    ROOM2: 'Room 2',
    ADMIN_ROOM: 'Admin Room',
    PRIVATE1: 'Private 1', // New Room
    PRIVATE2: 'Private 2'  // New Room
};
const ADMIN_PASSWORD = 'o5i';
const PRIVATE1_PASSWORD = 'personal'; // Password for Private 1
const PRIVATE2_PASSWORD = 'link';     // Password for Private 2


// --- Function to prompt for username ---
function getUsername() {
    let userPrompt = prompt("Welcome to BlipChat! Please enter your username:");
    if (!userPrompt || userPrompt.trim() === '') {
        username = "Anonymous"; // Default if user cancels or enters nothing
    } else {
        username = userPrompt.trim().substring(0, 20); // Trim whitespace and limit length
    }
    console.log(`Your username is: ${username}`);
    // Immediately join the default room after getting username
    joinRoom(currentRoom, null);
}

// Helper function to add a message to the UI
function addMessageToUI(senderUsername, msgText, isMine = false, isSystem = false) {
    const item = document.createElement('li');

    if (isSystem) {
        item.classList.add('system-message');
        item.textContent = msgText; // System messages don't have a username prefix
    } else {
        item.innerHTML = `<strong>${senderUsername}:</strong> ${msgText}`;
    }

    if (isMine) {
        item.classList.add('my-message'); // Add class for styling 'my' messages
    }
    messages.appendChild(item);
    // Scroll to the bottom to see the latest message
    messages.scrollTop = messages.scrollHeight;
}

// --- Function to handle joining a room ---
function joinRoom(roomName, password) {
    // If trying to join Admin Room, prompt for password
    if (roomName === ROOM_NAMES.ADMIN_ROOM && !password) {
        password = prompt("Enter password for Admin Room:");
        if (!password) { // If user cancels password prompt
            alert("Room join cancelled.");
            return;
        }
    }
    // If trying to join Private 1, prompt for password (NEW)
    if (roomName === ROOM_NAMES.PRIVATE1 && !password) {
        password = prompt("Enter password for Private 1:");
        if (!password) {
            alert("Room join cancelled.");
            return;
        }
    }
    // If trying to join Private 2, prompt for password (NEW)
    if (roomName === ROOM_NAMES.PRIVATE2 && !password) {
        password = prompt("Enter password for Private 2:");
        if (!password) {
            alert("Room join cancelled.");
            return;
        }
    }

    socket.emit('joinRoom', { roomName, password, username });
}

// --- Event listener for room list clicks ---
roomList.addEventListener('click', (e) => {
    const clickedItem = e.target.closest('.room-item');
    if (clickedItem) {
        const newRoom = clickedItem.dataset.room;
        if (newRoom && newRoom !== currentRoom) {
            // Remove active class from old room in UI (will be updated by server confirmation)
            const activeItem = document.querySelector('.room-item.active');
            if (activeItem) {
                activeItem.classList.remove('active');
            }
            // Add active class to new room (temporarily, will be confirmed by server)
            clickedItem.classList.add('active');

            // Update currentRoomDisplay temporarily
            currentRoomDisplay.textContent = newRoom;

            // Attempt to join the room
            joinRoom(newRoom, null); // Pass null for password initially, will prompt if needed
        }
    }
});


// When the form is submitted (message sent)
form.addEventListener('submit', (e) => {
    e.preventDefault(); // Prevent page reload
    if (input.value && currentRoom) { // Ensure message has content and a room is active
        // Emit a 'chat message' event to the server
        const messageData = {
            id: clientId, // So the client can identify its own messages
            username: username, // The chosen username
            text: input.value,
            room: currentRoom // Include the current room name
        };
        socket.emit('chat message', messageData);
        input.value = ''; // Clear the input field
    }
});

// When a 'chat message' event is received from the server (for live updates)
socket.on('chat message', (messageData) => {
    // Only display message if it belongs to the current room
    if (messageData.room === currentRoom) {
        const isMine = messageData.id === clientId;
        const isSystem = messageData.id === 'system';
        addMessageToUI(messageData.username, messageData.text, isMine, isSystem);
    }
});

// When 'roomJoined' event is received from the server
socket.on('roomJoined', (data) => {
    currentRoom = data.roomName; // Update client's current room state
    messages.innerHTML = ''; // Clear existing messages
    currentRoomDisplay.textContent = data.roomName; // Update room display in header

    // Update active room in sidebar
    document.querySelectorAll('.room-item').forEach(item => {
        if (item.dataset.room === data.roomName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });

    // Display historical messages for the joined room
    data.history.forEach(messageData => {
        const isMine = messageData.id === clientId;
        const isSystem = messageData.id === 'system';
        addMessageToUI(messageData.username, messageData.text, isMine, isSystem);
    });
    // Add a system message for successfully joining
    addMessageToUI('System', `You joined ${data.roomName}.`, false, true);
});

// Handle failed room joins
socket.on('roomJoinFailed', (reason) => {
    alert(`Failed to join room: ${reason}`);

    // Revert UI to the previously active room
    document.querySelectorAll('.room-item').forEach(item => {
        if (item.dataset.room === currentRoom) { // currentRoom still holds the last successfully joined room
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    currentRoomDisplay.textContent = currentRoom; // Revert display to current room
});


// Optional: Log connection/disconnection for debugging
socket.on('connect', () => {
    console.log('Connected to BlipChat server!');
    clientId = socket.id; // Set clientId here once connected to ensure it's a valid socket ID
    console.log(`Your client ID is: ${clientId}`);

    // If username hasn't been set yet (e.g., first load), get it.
    // Then attempt to join the default room.
    if (!username) {
        getUsername();
    } else {
        // If already connected and username exists, re-join current room on reconnect
        joinRoom(currentRoom, null);
    }
});

socket.on('disconnect', () => {
    console.log('Disconnected from BlipChat server.');
});

socket.on('connect_error', (err) => {
    console.log(`Connection Error: ${err.message}`);
    alert(`Connection Error: ${err.message}. Please try refreshing the page.`);
});

// Initial call to set active room on load (before socket connects)
// This ensures 'Room 1' is highlighted as it's the default and JS loads after HTML
document.getElementById('room-1').classList.add('active');
currentRoomDisplay.textContent = 'Room 1'; // Set initial display text
