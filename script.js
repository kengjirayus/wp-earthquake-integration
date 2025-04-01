// ตั้งค่า API
const API_URL = 'https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson';
const CENTER_LAT = 13.764618; // ละติจูดอนุสาวรีย์ชัยสมรภูมิ
const CENTER_LON = 100.538572; // ลองติจูดอนุสาวรีย์ชัยสมรภูมิ
const RADIUS_KM = 1100;       // รัศมี 1,100 กม.
const MIN_MAGNITUDE = 5.0;    // แผ่นดินไหวขนาด 5.0 ขึ้นไป
const DANGER_MAGNITUDE = 6.0; // ระดับที่ถือว่าอันตราย (สีแดง)

// ฟังก์ชันคำนวณระยะทางจากจุดศูนย์กลาง (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // รัศมีโลก (กม.)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ฟังก์ชันจัดรูปแบบวันที่ไทย
function formatThaiDateTime(date) {
    const options = { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit',
        timeZone: 'Asia/Bangkok'
    };
    return date.toLocaleDateString('th-TH', options);
}

// ส่งความสูง iframe ไปยัง WordPress
function sendIframeHeight() {
    const height = document.documentElement.scrollHeight;
    window.parent.postMessage({
        type: 'iframeHeight',
        height: height
    }, '*');
    console.log('Sent iframe height:', height);
}

// ฟังก์ชันหลักดึงข้อมูล
async function loadEarthquakeData() {
    try {
        // แสดงสถานะกำลังโหลด
        document.getElementById('earthquake-data').innerHTML = `
            <div class="loading-container">
                <div class="loading-spinner"></div>
                <p>กำลังโหลดข้อมูลแผ่นดินไหวล่าสุด...</p>
            </div>`;

        // ดึงข้อมูลจาก API
        const params = new URLSearchParams({
            latitude: CENTER_LAT,
            longitude: CENTER_LON,
            maxradiuskm: RADIUS_KM,
            minmagnitude: MIN_MAGNITUDE,
            limit: 100
        });

        const response = await fetch(`${API_URL}&${params.toString()}`);
        const data = await response.json();
        
        // แสดงผลข้อมูล
        displayData(data.features);
        
        // อัปเดตเวลาล่าสุด
        document.getElementById('update-time').textContent = 
            `อัปเดตล่าสุด: ${formatThaiDateTime(new Date())}`;
        
    } catch (error) {
        console.error('Error fetching data:', error);
        document.getElementById('earthquake-data').innerHTML = `
            <div class="error">
                <p>⚠️ ไม่สามารถโหลดข้อมูลได้ โปรดลองใหม่ภายหลัง</p>
                <button onclick="loadEarthquakeData()">ลองอีกครั้ง</button>
            </div>`;
    } finally {
        sendIframeHeight(); // ส่งความสูงเสมอไม่ว่าจะสำเร็จหรือล้มเหลว
    }
}

// แสดงผลข้อมูลในตาราง
function displayData(earthquakes) {
    if (!earthquakes || earthquakes.length === 0) {
        document.getElementById('earthquake-data').innerHTML = `
            <p class="no-data">ไม่พบข้อมูลแผ่นดินไหวล่าสุดในรัศมีย่านนี้</p>`;
        sendIframeHeight();
        return;
    }

    // เรียงลำดับจากใหม่ไปเก่า
    earthquakes.sort((a, b) => b.properties.time - a.properties.time);

    let html = `
    <table>
        <thead>
            <tr>
                <th>เวลาเกิดเหตุ</th>
                <th>ขนาด</th>
                <th>ศูนย์กลาง/ระยะห่าง</th>
                <th>ความลึก (กม.)</th>
            </tr>
        </thead>
        <tbody>`;

    earthquakes.forEach(quake => {
        const props = quake.properties;
        const coords = quake.geometry.coordinates;
        
        // คำนวณระยะทาง
        const distance = calculateDistance(
            CENTER_LAT, CENTER_LON, 
            coords[1], coords[0]
        ).toFixed(0);

        // จัดรูปแบบข้อมูล
        const time = formatThaiDateTime(new Date(props.time));
        const mag = props.mag.toFixed(1);
        const depth = coords[2].toFixed(1);
        
        // แยกชื่อสถานที่
        const placeParts = props.place.split(', ');
        const mainLocation = placeParts[0];
        const region = placeParts.slice(1).join(', ');
        
        // ตรวจสอบแผ่นดินไหวอันตราย
        const isDanger = props.mag >= DANGER_MAGNITUDE;
        const rowClass = isDanger ? 'danger-row' : '';
        
        html += `
            <tr class="${rowClass}">
                <td>${time}</td>
                <td>${mag}</td>
                <td>
                    <div class="location">
                        <strong>${mainLocation}</strong>
                        <span class="region">${region}</span>
                        <span class="distance">ห่างจากอนุสาวรีย์ฯ ${distance} กม.</span>
                    </div>
                </td>
                <td>${depth}</td>
            </tr>`;
    });

    html += `</tbody></table>`;
    document.getElementById('earthquake-data').innerHTML = html;
    sendIframeHeight(); // ส่งความสูงหลังแสดงข้อมูล
}

// ตั้งค่าการสื่อสารกับ iframe
function setupIframeResizer() {
    // ส่งความสูงเมื่อโหลดเสร็จ
    window.addEventListener('load', sendIframeHeight);
    
    // ส่งความสูงเมื่อหน้าขยาย/ย่อ
    new ResizeObserver(sendIframeHeight).observe(document.body);
    
    // ตอบสนองเมื่อ WordPress ขอความสูง
    window.addEventListener('message', function(e) {
        if (e.data === 'getHeight') {
            sendIframeHeight();
        }
    });
}

// เริ่มต้นการทำงาน
setupIframeResizer();
loadEarthquakeData();

// อัปเดตข้อมูลทุก 10 นาที
setInterval(loadEarthquakeData, 10 * 60 * 1000);