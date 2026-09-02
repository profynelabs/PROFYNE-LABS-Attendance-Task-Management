const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

const users = [];
const activityLogs = [];
const otpStore = {};

// হোম পেজ বা রুট ইউআরএল এ ভিজিট করলে সরাসরি লগইন পেজ দেখাবে
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.post('/api/register', (req, res) => {
    const { fullname, designation, email, phone, password, profilePic } = req.body;

    if (users.find(u => u.phone === phone)) {
        return res.status(400).json({ success: false, message: "User already exists with this phone number!" });
    }

    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    otpStore[phone] = { fullname, designation, email, phone, password, profilePic, otp };

    console.log(`[OTP Generated] For ${phone}: ${otp}`);
    res.json({ success: true, message: "OTP sent successfully!", debugOtp: otp });
});

app.post('/api/verify-otp', (req, res) => {
    const { phone, otp } = req.body;

    if (otpStore[phone] && otpStore[phone].otp === otp) {
        const userData = otpStore[phone];
        users.push({
            fullname: userData.fullname,
            designation: userData.designation,
            email: userData.email,
            phone: userData.phone,
            password: userData.password,
            profilePic: userData.profilePic || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80",
            totalSeconds: 0,
            clockInTime: null,
            status: "Offline",
            currentTask: "No active task",
            taskComment: "No comments yet"
        });
        delete otpStore[phone];
        res.json({ success: true, message: "Registration verified successfully!" });
    } else {
        res.status(400).json({ success: false, message: "Invalid OTP!" });
    }
});

app.post('/api/login', (req, res) => {
    const { phone, password } = req.body;
    const user = users.find(u => u.phone === phone && u.password === password);

    if (user) {
        user.status = "Active / Present";
        user.clockInTime = Date.now();
        activityLogs.unshift({ phone, name: user.fullname, action: "Clocked In", time: new Date().toLocaleTimeString() });
        res.json({ success: true, user });
    } else {
        res.status(401).json({ success: false, message: "Invalid phone or password!" });
    }
});

app.post('/api/logout', (req, res) => {
    const { phone } = req.body;
    const user = users.find(u => u.phone === phone);
    if (user) {
        user.status = "Offline";
        if (user.clockInTime) {
            const sessionDuration = Math.floor((Date.now() - user.clockInTime) / 1000);
            user.totalSeconds += sessionDuration;
            user.clockInTime = null;
        }
        activityLogs.unshift({ phone, name: user.fullname, action: "Clocked Out", time: new Date().toLocaleTimeString() });
    }
    res.json({ success: true });
});

// টাস্ক এবং কমেন্ট আপডেট করার রুট
app.post('/api/update-task', (req, res) => {
    const { phone, currentTask, taskComment } = req.body;
    const user = users.find(u => u.phone === phone);
    if (user) {
        user.currentTask = currentTask || user.currentTask;
        user.taskComment = taskComment || user.taskComment;
        res.json({ success: true, user });
    } else {
        res.status(404).json({ success: false, message: "User not found!" });
    }
});

app.get('/api/users', (req, res) => {
    const responseUsers = users.map(u => {
        let currentSeconds = u.totalSeconds;

        if (u.status === "Active / Present" && u.clockInTime) {
            currentSeconds += Math.floor((Date.now() - u.clockInTime) / 1000);
        }

        const hrs = Math.floor(currentSeconds / 3600);
        const mins = Math.floor((currentSeconds % 3600) / 60);
        const secs = currentSeconds % 60;

        const formattedTime = `${hrs}h ${mins}m ${secs}s`;

        return {
            fullname: u.fullname,
            designation: u.designation,
            email: u.email,
            phone: u.phone,
            profilePic: u.profilePic,
            status: u.status,
            currentTask: u.currentTask,
            taskComment: u.taskComment,
            formattedTime,
            totalSeconds: currentSeconds
        };
    });
    res.json(responseUsers);
});

app.get('/api/logs', (req, res) => {
    res.json(activityLogs);
});

// ----------------------------------------------------------------------------------
// অ্যাডমিন ড্যাশবোর্ডের জন্য সকল রেজিস্টার্ড ইউজারের তালিকা পাওয়ার এপিআই
app.get('/api/admin/users', (req, res) => {
    const formattedUsers = users.map(u => ({
        id: u.phone,
        fullname: u.fullname,
        designation: u.designation,
        email: u.email,
        phone: u.phone,
        password: u.password,
        profilePic: u.profilePic
    }));
    res.json({ success: true, users: formattedUsers });
});

// অ্যাডমিন প্যানেল থেকে কোনো ইউজারকে ডিলিট করার এপিআই
app.delete('/api/admin/user/:id', (req, res) => {
    const userId = req.params.id;
    const index = users.findIndex(u => u.phone === userId);

    if (index !== -1) {
        users.splice(index, 1);
        res.json({ success: true, message: "User deleted successfully" });
    } else {
        res.status(404).json({ success: false, message: "User not found!" });
    }
});

app.listen(3000, () => {
    console.log(`PROFYNE LABS Server running on http://localhost:3000`);
});