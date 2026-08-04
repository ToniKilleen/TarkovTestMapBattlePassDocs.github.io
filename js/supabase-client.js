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
        if (!res.ok) {
            const errText = await res.text();
            console.error('ADD failed:', res.status, errText);
            throw new Error(`Ошибка добавления: ${res.status} — ${errText}`);
        }
        return await res.json();
    },

    async updateMarker(marker) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/markers?id=eq.${encodeURIComponent(marker.id)}`, {
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
        if (!res.ok) {
            const errText = await res.text();
            console.error('UPDATE failed:', res.status, errText);
            throw new Error(`Ошибка обновления: ${res.status} — ${errText}`);
        }
        return await res.json();
    },

    async deleteMarker(id) {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/markers?id=eq.${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: {
                ...this.headers,
                'Prefer': 'return=representation'
            }
        });

        const responseText = await res.text();

        if (!res.ok) {
            console.error('DELETE failed:', res.status, responseText);
            throw new Error(`Ошибка удаления: ${res.status} — ${responseText}`);
        }

        try {
            const deleted = JSON.parse(responseText);
            if (Array.isArray(deleted) && deleted.length === 0) {
                console.warn('DELETE вернул пустой массив — точки нет в базе (возможно, она из локального файла)');
                // Не бросаем ошибку — просто удаляем локально
            } else {
                console.log('✅ Удалено записей:', deleted.length);
            }
        } catch (e) {
            console.log('DELETE выполнен, ответ пустой');
        }
    },

    async getSuggestions(status = null) {
        let url = `${SUPABASE_URL}/rest/v1/suggestions?select=*&order=created_at.desc`;
        if (status) url += `&status=eq.${status}`;

        const res = await fetch(url, { headers: this.headers });
        if (!res.ok) throw new Error(`${res.status}`);
        const suggestions = await res.json();

        const userIds = [...new Set(suggestions.map(s => s.created_by).filter(Boolean))];
        if (userIds.length > 0) {
            const usersRes = await fetch(
                `${SUPABASE_URL}/rest/v1/users?id=in.(${userIds.join(',')})&select=id,username`,
                { headers: this.headers }
            );
            if (usersRes.ok) {
                const users = await usersRes.json();
                const userMap = {};
                users.forEach(u => { userMap[u.id] = u.username; });

                suggestions.forEach(s => {
                    s.author_username = userMap[s.created_by] || '?';
                });
            }
        }

        return suggestions;
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
        if (!res.ok) {
            const errText = await res.text();
            console.error('ADD suggestion failed:', res.status, errText);
            throw new Error(`Ошибка: ${res.status} — ${errText}`);
        }
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
        if (!res.ok) {
            const errText = await res.text();
            console.error('REVIEW failed:', res.status, errText);
            throw new Error(`Ошибка: ${res.status} — ${errText}`);
        }
        return await res.json();
    },

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