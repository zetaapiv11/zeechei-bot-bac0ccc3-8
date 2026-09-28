/**
 * @format
 *
 * Arrkii By Ozuma xd
 * © 2024 Arrkii Development
 *
 */

module.exports = {
    convertTime: function (duration) {
        if (duration === undefined || duration === null) {
            return "00:00";
        }

        // If duration is already a number (milliseconds)
        if (typeof duration === "number") {
            const seconds = Math.floor(duration / 1000);
            const minutes = Math.floor(seconds / 60);
            const hours = Math.floor(minutes / 60);

            const finalSeconds = seconds % 60;
            const finalMinutes = minutes % 60;

            if (hours > 0) {
                return `${hours}:${String(finalMinutes).padStart(2, "0")}:${String(finalSeconds).padStart(2, "0")}`;
            }

            return `${String(finalMinutes).padStart(2, "0")}:${String(finalSeconds).padStart(2, "0")}`;
        }

        // Convert string duration safely
        const value = String(duration).trim();

        if (!value) {
            return "00:00";
        }

        // HH:MM:SS
        if (value.split(":").length === 3) {
            const parts = value.split(":");

            const hours = parseInt(parts[0]) || 0;
            const minutes = parseInt(parts[1]) || 0;
            const seconds = parseInt(parts[2]) || 0;

            return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        }

        // MM:SS
        if (value.split(":").length === 2) {
            const parts = value.split(":");

            const minutes = parseInt(parts[0]) || 0;
            const seconds = parseInt(parts[1]) || 0;

            return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        }

        // Numeric string = milliseconds
        const milliseconds = Number(value);

        if (!Number.isNaN(milliseconds)) {
            const totalSeconds = Math.floor(milliseconds / 1000);
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;

            return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
        }

        return "00:00";
    }
};