/**
 * Supabase клиент
 */
const SUPABASE_URL = 'https://fiugssqfnenuzcpqvpoj.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_UzEXWvBbFgOKzVs_x1oK6A_qkSlV1Qp';

const SupabaseDB = {
    headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
    },

    // ===== МАРКЕРЫ =====
    async getMarkers() {
        try {
            const res = await fetch(`${SUPABASE_URL}/rest/v1/markers?select=*`, {
                headers: this.headers
            });
            if (!res.ok) throw new Error(`${res.status}`);
            const data = await res.json();
            return data.map(row => ({
                id: row.id,
                mapId: row.map_id,
                name: row.name,
                category: row.category,
                lat: row.lat,
                lng: row.lng,
                description: row.description || '',
                screenshot: row.screenshot || ''
            }));
        } catch (e) {
            console.error('Ошибка загрузки маркеров:', e);
            return null;
        }
    },

    async addMarker(marker) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/markers`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                id: marker.id,
                map_id: marker.mapId,
                name: marker.name,
                category: marker.category,
                lat: marker.lat,
                lng: marker.lng,
                description: marker.description,
                screenshot: marker.screenshot,
                created_by: marker.userId || null
            })
        });
        if (!res.ok) throw new Error(`Ошибка добавления: ${res.status}`);
        return await res.json();
    },

    async updateMarker(marker) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/markers?id=eq.${marker.id}`, {
            method: 'PATCH',
            headers: this.headers,
            body: JSON.stringify({
                map_id: marker.mapId,
                name: marker.name,
                category: marker.category,
                lat: marker.lat,
                lng: marker.lng,
                description: marker.description,
                screenshot: marker.screenshot,
                updated_at: new Date().toISOString()
            })
        });
        if (!res.ok) throw new Error(`Ошибка обновления: ${res.status}`);
        return await res.json();
    },

    async deleteMarker(id) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/markers?id=eq.${id}`, {
            method: 'DELETE',
            headers: this.headers
        });
        if (!res.ok) throw new Error(`Ошибка удаления: ${res.status}`);
    },

    // ===== ПРЕДЛОЖЕНИЯ =====
    async getSuggestions(status = null) {
        let url = `${SUPABASE_URL}/rest/v1/suggestions?select=*,created_by(username)&order=created_at.desc`;
        if (status) url += `&status=eq.${status}`;

        const res = await fetch(url, { headers: this.headers });
        if (!res.ok) throw new Error(`${res.status}`);
        return await res.json();
    },

    async addSuggestion(suggestion) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/suggestions`, {
            method: 'POST',
            headers: this.headers,
            body: JSON.stringify({
                map_id: suggestion.mapId,
                name: suggestion.name,
                category: suggestion.category,
                lat: suggestion.lat,
                lng: suggestion.lng,
                description: suggestion.description,
                screenshot: suggestion.screenshot,
                created_by: suggestion.userId,
                status: 'pending'
            })
        });
        if (!res.ok) throw new Error(`${res.status}`);
        return await res.json();
    },

    async reviewSuggestion(suggestionId, status, adminComment, adminId) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/suggestions?id=eq.${suggestionId}`, {
            method: 'PATCH',
            headers: this.headers,
            body: JSON.stringify({
                status: status,
                admin_comment: adminComment,
                reviewed_at: new Date().toISOString(),
                reviewed_by: adminId
            })
        });
        if (!res.ok) throw new Error(`${res.status}`);
        return await res.json();
    },

    // ===== АВТОРИЗАЦИЯ =====
    async login(username, password) {
        const hash = await this.hashPassword(password);
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/users?username=eq.${encodeURIComponent(username)}&password_hash=eq.${hash}&select=*`,
            { headers: this.headers }
        );
        if (!res.ok) throw new Error(`${res.status}`);
        const users = await res.json();
        if (users.length === 0) return null;
        return users[0];
    },

    async hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },

    // ===== ЗАГРУЗКА СКРИНШОТОВ =====
    async uploadScreenshot(file) {
        const ext = file.type.split('/')[1] || 'png';
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 8)}.${ext}`;

        try {
            const res = await fetch(`${SUPABASE_URL}/storage/v1/object/screenshots/${fileName}`, {
                method: 'POST',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': file.type,
                    'x-upsert': 'true'
                },
                body: file
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error('Storage error:', errText);
                return await this.fileToDataUrl(file);
            }

            return `${SUPABASE_URL}/storage/v1/object/public/screenshots/${fileName}`;
        } catch (e) {
            console.error('Upload failed:', e);
            return await this.fileToDataUrl(file);
        }
    },

    fileToDataUrl(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.readAsDataURL(file);
        });
    }
};