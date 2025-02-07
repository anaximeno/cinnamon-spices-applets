/* eyeModes.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
'use strict';

const { Clutter } = imports.gi;

class EyeMode {
    constructor(mode) {
        this.mode = mode;
    }

    /**
     * Draws the eye on the panel
     * @param {St.DrawingArea} area The area on repaint
     * @param {Object} options Drawing options
     */
    drawEye(area, options) {
        // Implemented by sub-classes
    };

    topAndLatSizes(area_width, area_height, options) {
        let top_size, lat_size;

        if (options.is_vertical) {
            top_size = area_width;
            lat_size = area_height;
        } else {
            top_size = area_height;
            lat_size = area_width;
        }

        return [top_size, lat_size];
    }

    /** Add a ransparent background to avoid blemishes from previous drawings. */
    clearArea(cr, area_width, area_height) {
        cr.save();
        cr.setSourceRGBA(0, 0, 0, 0);
        cr.rectangle(0, 0, area_width, area_height);
        cr.fill();
        cr.restore();
    }
}

class EyelidMode extends EyeMode {
    drawEye(area, options) {
        const TWO_PI = 2 * Math.PI;
        const LID_TOP_FACTOR = 0.8;
        const LID_BOTTOM_FACTOR = 0.6;

        const [areaWidth, areaHeight] = area.allocation.get_size();
        const centerX = areaWidth / 2;
        const centerY = areaHeight / 2;

        // Mouse position calculations
        const mouseX = options.mouse_x - options.area_x - centerX;
        const mouseY = options.mouse_y - options.area_y - centerY;
        const mouseAng = Math.atan2(mouseY, mouseX);
        let mouseRad = Math.hypot(mouseX, mouseY);

        // Eye dimensions
        const [topSize, latSize] = this.topAndLatSizes(areaWidth, areaHeight, options);
        const eyeRad = Math.min(topSize - options.padding, latSize) / 2;

        // Feature sizes
        const irisRad = eyeRad * 0.5;
        const pupilRad = irisRad * 0.4;

        // Improved maxRad calculation using precomputed cosine
        const cosAng = Math.cos(mouseAng);
        const maxRad = eyeRad * ((cosAng ** 4) * 0.5 + 0.25);
        mouseRad = Math.min(mouseRad, maxRad);

        // Simplified iris position math
        const irisR = Math.sqrt(eyeRad ** 2 - irisRad ** 2);
        const eyeAng = Math.atan(mouseRad / irisR);

        const cr = area.get_context();
        this.clearArea(cr, areaWidth, areaHeight);
        cr.save();

        // Base eye drawing
        cr.translate(centerX, centerY);
        Clutter.cairo_set_source_color(cr, options.base_color);
        cr.setLineWidth(options.line_width);

        // Eyelid path construction (reusable)
        const createLidPath = () => {
            const sinEyeAng = Math.sin(eyeAng);
            const xDef = irisRad * cosAng * sinEyeAng;
            const yDef = irisRad * Math.sin(mouseAng) * sinEyeAng;

            cr.moveTo(-eyeRad, 0);
            cr.curveTo(
                xDef - irisRad, yDef + eyeRad * LID_TOP_FACTOR,
                xDef + irisRad, yDef + eyeRad * LID_TOP_FACTOR,
                eyeRad, 0
            );
            cr.curveTo(
                xDef + irisRad, yDef - eyeRad * LID_BOTTOM_FACTOR,
                xDef - irisRad, yDef - eyeRad * LID_BOTTOM_FACTOR,
                -eyeRad, 0
            );
        };

        // Draw and fill/stroke lids
        createLidPath();
        options.lids_fill ? cr.fill() : cr.stroke();

        // Create clipping path
        createLidPath();
        cr.clip();

        // Iris drawing
        Clutter.cairo_set_source_color(cr, options.iris_color);
        cr.save();
        cr.rotate(mouseAng);
        cr.translate(irisR * Math.sin(eyeAng), 0);
        
        const irisScaleX = irisRad * Math.cos(eyeAng);
        cr.scale(irisScaleX, irisRad);
        cr.setLineWidth(options.line_width / irisRad);
        cr.arc(0, 0, 1, 0, TWO_PI);
        options.lids_fill ? cr.fill() : cr.stroke();
        cr.restore();

        // Pupil drawing
        Clutter.cairo_set_source_color(cr, options.pupil_color);
        cr.save();
        cr.translate(eyeRad * Math.sin(eyeAng), 0);
        
        const pupilScaleX = pupilRad * Math.cos(eyeAng);
        cr.scale(pupilScaleX, pupilRad);
        cr.arc(0, 0, 1, 0, TWO_PI);
        cr.fill();
        cr.restore();

        cr.restore();
    }
}


class BulbMode extends EyeMode {
    drawEye(area, options) {
        const TWO_PI = 2 * Math.PI;
        const [areaWidth, areaHeight] = area.allocation.get_size();
        const centerX = areaWidth / 2;
        const centerY = areaHeight / 2;

        // Calculate mouse position relative to the eye's center
        const mouseX = options.mouse_x - options.area_x - centerX;
        const mouseY = options.mouse_y - options.area_y - centerY;

        // Use hypot for more efficient and accurate radius calculation
        let mouseRad = Math.hypot(mouseX, mouseY);
        const mouseAng = Math.atan2(mouseY, mouseX);

        // Calculate eye dimensions
        const [topSize, latSize] = this.topAndLatSizes(areaWidth, areaHeight, options);
        const eyeRad = Math.min(topSize - options.padding, latSize) / 2;

        // Iris and pupil radii (precompute for clarity)
        const irisRad = eyeRad * 0.6;
        const pupilRad = irisRad * 0.4;

        // Simplified max_rad using algebraic identity: sqrt(eyeRad² - irisRad²)
        const maxRad = Math.sqrt(eyeRad ** 2 - irisRad ** 2) - options.line_width;
        mouseRad = Math.min(mouseRad, maxRad);

        // Precompute iris radius in eye's coordinate system
        const irisR = Math.sqrt(eyeRad ** 2 - irisRad ** 2);
        const eyeAng = Math.atan(mouseRad / irisR);

        const cr = area.get_context();
        this.clearArea(cr, areaWidth, areaHeight);

        cr.save();

        // Draw eye base
        cr.translate(centerX, centerY);
        Clutter.cairo_set_source_color(cr, options.base_color);
        cr.setLineWidth(options.line_width);
        cr.arc(0, 0, eyeRad, 0, TWO_PI);
        options.bulb_fill ? cr.fill() : cr.stroke();

        // Draw iris
        Clutter.cairo_set_source_color(cr, options.iris_color);
        cr.rotate(mouseAng);
        cr.translate(irisR * Math.sin(eyeAng), 0);

        // Scale factors for the iris
        const irisScaleX = irisRad * Math.cos(eyeAng);
        cr.scale(irisScaleX, irisRad);
        cr.setLineWidth(options.line_width / irisRad);
        cr.arc(0, 0, 1, 0, TWO_PI);
        options.bulb_fill ? cr.fill() : cr.stroke();

        // Reset iris transformations
        cr.scale(1 / irisScaleX, 1 / irisRad);
        cr.translate(-irisR * Math.sin(eyeAng), 0);

        // Draw pupil
        Clutter.cairo_set_source_color(cr, options.pupil_color);
        const pupilTranslation = eyeRad * Math.sin(eyeAng);
        cr.translate(pupilTranslation, 0);

        // Scale factors for the pupil
        const pupilScaleX = pupilRad * Math.cos(eyeAng);
        cr.scale(pupilScaleX, pupilRad);
        cr.arc(0, 0, 1, 0, TWO_PI);
        cr.fill();

        cr.restore();
    }
}


class EyeModeFactory {
    /**
     * Returns an eye mode depending on the given name
     * @param {String} mode Eye mode name to create
     * @returns EyeMode subclass
     */
    static createEyeMode(mode) {
        switch (mode) {
            case "bulb":
                return new BulbMode(mode);

            case "lids":
            default:
                return new EyelidMode(mode);
        }
    }
}
