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
const Cairo = imports.cairo;

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
        const [area_width, area_height] = area.allocation.get_size();
        const mouse_x = options.mouse_x - options.area_x - area_width / 2;
        const mouse_y = options.mouse_y - options.area_y - area_height / 2;

        const mouse_ang = Math.atan2(mouse_y, mouse_x);
        let mouse_rad = Math.sqrt(mouse_x * mouse_x + mouse_y * mouse_y);

        const [top_size, lat_size] = this.topAndLatSizes(area_width, area_height, options);
        let eye_rad = Math.min(top_size - options.padding, lat_size) / 2;

        const iris_rad = eye_rad * 0.5;
        const pupil_rad = iris_rad * 0.4;

        const max_rad = eye_rad * (Math.pow(Math.cos(mouse_ang), 4) * 0.5 + 0.25);

        mouse_rad = Math.min(mouse_rad, max_rad);

        const iris_arc = Math.asin(iris_rad / eye_rad);
        const iris_r = eye_rad * Math.cos(iris_arc);

        const eye_ang = Math.atan(mouse_rad / iris_r);

        let cr = area.get_context();
        this.clearArea(cr, area_width, area_height);

        cr.save();

        // -- Drawing the base of the eye

        Clutter.cairo_set_source_color(cr, options.base_color);

        cr.translate(area_width * 0.5, area_height * 0.5);
        cr.setLineWidth(options.line_width);

        const x_def = iris_rad * Math.cos(mouse_ang) * (Math.sin(eye_ang));
        const y_def = iris_rad * Math.sin(mouse_ang) * (Math.sin(eye_ang));

        const top_lid = 0.8;
        const bottom_lid = 0.6;

        let amp = eye_rad * top_lid;

        cr.moveTo(-eye_rad, 0);
        cr.curveTo(x_def - iris_rad, y_def + amp,
            x_def + iris_rad, y_def + amp, eye_rad, 0);

        amp = eye_rad * bottom_lid;
        cr.curveTo(x_def + iris_rad, y_def - amp,
            x_def - iris_rad, y_def - amp, -eye_rad, 0);

        options.lids_fill ? cr.fill() : cr.stroke();

        amp = eye_rad * top_lid;
        cr.moveTo(-eye_rad, 0);
        cr.curveTo(x_def - iris_rad, y_def + amp,
            x_def + iris_rad, y_def + amp, eye_rad, 0);

        amp = eye_rad * bottom_lid;
        cr.curveTo(x_def + iris_rad, y_def - amp,
            x_def - iris_rad, y_def - amp, -eye_rad, 0);
        cr.clip();

        // -- Drawing the iris of the eye

        cr.rotate(mouse_ang);
        cr.setLineWidth(options.line_width / iris_rad);

        Clutter.cairo_set_source_color(cr, options.iris_color);

        cr.translate(iris_r * Math.sin(eye_ang), 0);
        cr.scale(iris_rad * Math.cos(eye_ang), iris_rad);
        cr.arc(0, 0, 1.0, 0, 2 * Math.PI);

        options.lids_fill ? cr.fill() : cr.stroke();

        cr.scale(1 / (iris_rad * Math.cos(eye_ang)), 1 / iris_rad);
        cr.translate(-iris_r * Math.sin(eye_ang), 0);

        // -- Drawing the pupil of the eye

        Clutter.cairo_set_source_color(cr, options.pupil_color);

        cr.translate(eye_rad * Math.sin(eye_ang), 0);
        cr.scale(pupil_rad * Math.cos(eye_ang), pupil_rad);
        cr.arc(0, 0, 1.0, 0, 2 * Math.PI);
        cr.fill();

        cr.restore();
    }
}


class BulbMode extends EyeMode {
    drawEye(area, options) {
        const [area_width, area_height] = area.allocation.get_size();
        const mouse_x = options.mouse_x - options.area_x - area_width / 2;
        const mouse_y = options.mouse_y - options.area_y - area_height / 2;

        let mouse_rad = Math.sqrt(mouse_x * mouse_x + mouse_y * mouse_y);
        const mouse_ang = Math.atan2(mouse_y, mouse_x);

        const [top_size, lat_size] = this.topAndLatSizes(area_width, area_height, options);
        let eye_rad = Math.min(top_size - options.padding, lat_size) / 2;

        const iris_rad = eye_rad * 0.6;
        const pupil_rad = iris_rad * 0.4;

        const max_rad = eye_rad * Math.cos(Math.asin((iris_rad) / eye_rad)) - options.line_width;

        mouse_rad = Math.min(mouse_rad, max_rad);

        const iris_arc = Math.asin(iris_rad / eye_rad);
        const iris_r = eye_rad * Math.cos(iris_arc);

        const eye_ang = Math.atan(mouse_rad / iris_r);

        let cr = area.get_context();
        this.clearArea(cr, area_width, area_height);

        cr.save();

        // -- Drawing the base of the eye

        Clutter.cairo_set_source_color(cr, options.base_color);

        cr.translate(area_width * 0.5, area_height * 0.5);
        cr.setLineWidth(options.line_width);
        cr.arc(0, 0, eye_rad, 0, 2 * Math.PI);

        options.bulb_fill ? cr.fill() : cr.stroke();

        // -- Drawing the iris of the eye

        cr.rotate(mouse_ang);
        cr.setLineWidth(options.line_width / iris_rad);

        Clutter.cairo_set_source_color(cr, options.iris_color);

        cr.translate(iris_r * Math.sin(eye_ang), 0);
        cr.scale(iris_rad * Math.cos(eye_ang), iris_rad);
        cr.arc(0, 0, 1.0, 0, 2 * Math.PI);

        options.bulb_fill ? cr.fill() : cr.stroke();

        cr.scale(1 / (iris_rad * Math.cos(eye_ang)), 1 / iris_rad);
        cr.translate(-iris_r * Math.sin(eye_ang), 0);

        // -- Drawing the pupil of the eye

        Clutter.cairo_set_source_color(cr, options.pupil_color);

        cr.translate(eye_rad * Math.sin(eye_ang), 0);
        cr.scale(pupil_rad * Math.cos(eye_ang), pupil_rad);
        cr.arc(0, 0, 1.0, 0, 2 * Math.PI);
        cr.fill();

        cr.restore();
    }
}

class RoboticEyeMode extends EyeMode {
    drawEye(area, options) {
        const TWO_PI = 2 * Math.PI;
        const [areaWidth, areaHeight] = area.allocation.get_size();
        const centerX = areaWidth / 2;
        const centerY = areaHeight / 2;

        // Mouse position calculations
        const mouseX = options.mouse_x - options.area_x - centerX;
        const mouseY = options.mouse_y - options.area_y - centerY;
        let mouseRad = Math.hypot(mouseX, mouseY);
        const mouseAng = Math.atan2(mouseY, mouseX);

        // Eye dimensions
        const [topSize, latSize] = this.topAndLatSizes(areaWidth, areaHeight, options);
        const eyeRad = Math.min(topSize - options.padding, latSize) / 2;

        // Robotic features
        const irisRad = eyeRad * 0.55;
        const pupilRad = irisRad * 0.35;
        const maxRad = Math.sqrt(eyeRad ** 2 - irisRad ** 2) - options.line_width;
        mouseRad = Math.min(mouseRad, maxRad);

        const irisR = Math.sqrt(eyeRad ** 2 - irisRad ** 2);
        const eyeAng = Math.atan(mouseRad / irisR);

        const cr = area.get_context();
        this.clearArea(cr, areaWidth, areaHeight);

        cr.save();
        cr.translate(centerX, centerY);

        // Metallic base using base_color
        const baseColor = options.base_color;
        const metallicGradient = new Cairo.LinearGradient(-eyeRad, -eyeRad, eyeRad, eyeRad);
        metallicGradient.addColorStopRGBA(
            0,
            baseColor.red * 0.8 / 255,
            baseColor.green * 0.8 / 255,
            baseColor.blue * 0.8 / 255,
            1
        );
        metallicGradient.addColorStopRGBA(
            0.5,
            baseColor.red * 1.2 / 255,
            baseColor.green * 1.2 / 255,
            baseColor.blue * 1.2 / 255,
            1
        );
        metallicGradient.addColorStopRGBA(
            1,
            baseColor.red * 0.5 / 255,
            baseColor.green * 0.5 / 255,
            baseColor.blue * 0.5 / 255,
            1
        );
        
        cr.setSource(metallicGradient);
        cr.setLineWidth(options.line_width * 1.5);
        cr.arc(0, 0, eyeRad, 0, TWO_PI);
        cr.strokePreserve();
        Clutter.cairo_set_source_color(cr, baseColor);
        cr.fill();
        
        // Prepare iris colors
        const irisColor = options.iris_color;
        const darkIrisColor = new Clutter.Color({
            red: irisColor.red * 0.7,
            green: irisColor.green * 0.7,
            blue: irisColor.blue * 0.7,
            alpha: irisColor.alpha
        });

        // Draw hexagonal iris
        cr.rotate(mouseAng);
        cr.translate(irisR * Math.sin(eyeAng), 0);
        const irisScaleX = irisRad * Math.cos(eyeAng);
        cr.scale(irisScaleX, irisRad);
        // Iris gradient
        const irisGradient = new Cairo.RadialGradient(0, 0, 0, 0, 0, 1);
        irisGradient.addColorStopRGBA(
            0,
            irisColor.red / 255,
            irisColor.green / 255,
            irisColor.blue / 255,
            1
        );
        irisGradient.addColorStopRGBA(
            1,
            darkIrisColor.red / 255,
            darkIrisColor.green / 255,
            darkIrisColor.blue / 255,
            1
        );
        cr.setSource(irisGradient);
        
        // Hexagonal pattern
        const hexSize = 1.2;
        const hexAngle = TWO_PI / 6;
        cr.moveTo(hexSize, 0);
        for(let i = 1; i <= 6; i++) {
            const angle = i * hexAngle;
            cr.lineTo(hexSize * Math.cos(angle), hexSize * Math.sin(angle));
        }
        cr.closePath();
        cr.fill();

        // Circuit pattern using iris color
        cr.setSourceRGBA(
            Math.min(irisColor.red * 1.2 / 255, 1),
            Math.min(irisColor.green * 1.2 / 255, 1),
            Math.min(irisColor.blue * 1.2 / 255, 1),
            0.3
        );
        cr.setLineWidth(0.1);
        for(let i = 0; i < 12; i++) {
            const angle = i * (TWO_PI / 12);
            cr.moveTo(Math.cos(angle) * 0.4, Math.sin(angle) * 0.4);
            cr.lineTo(Math.cos(angle) * 1.2, Math.sin(angle) * 1.2);
            cr.stroke();
        }

        // Pupil using pupil_color
        cr.translate(eyeRad * Math.sin(eyeAng), 0);
        const pupilScaleX = pupilRad * Math.cos(eyeAng);
        cr.scale(pupilScaleX, pupilRad);
        
        // Main pupil
        Clutter.cairo_set_source_color(cr, options.pupil_color);
        cr.arc(0, 0, 0.8, 0, TWO_PI);
        cr.fill();
        
        // Aperture blades using base color
        cr.setSourceRGBA(
            baseColor.red / 255,
            baseColor.green / 255,
            baseColor.blue / 255,
            0.8
        );
        cr.setLineWidth(0.15);
        for(let i = 0; i < 8; i++) {
            cr.rotate(TWO_PI / 8);
            cr.arc(0, 0, 0.9, -0.2, 0.2);
            cr.stroke();
        }

        // Central sensor using pupil color
        cr.setSourceRGBA(
            Math.min(options.pupil_color.red * 1.5 / 255, 1),
            Math.min(options.pupil_color.green * 1.5 / 255, 1),
            Math.min(options.pupil_color.blue * 1.5 / 255, 1),
            0.8
        );
        cr.arc(0, 0, 0.3, 0, TWO_PI);
        cr.fill();

        // Holographic rings using iris color
        cr.setSourceRGBA(
            irisColor.red,
            irisColor.green,
            irisColor.blue,
            0.3
        );
        cr.setLineWidth(0.05);
        for(let i = 1; i <= 3; i++) {
            cr.arc(0, 0, 0.4 + i * 0.2, 0, TWO_PI);
            cr.stroke();
        }

        cr.restore();

        // Outer glow using iris color
        cr.save();
        cr.translate(centerX, centerY);
        const glowGradient = new Cairo.RadialGradient(0, 0, eyeRad * 0.7, 0, 0, eyeRad * 1.2);
        glowGradient.addColorStopRGBA(0, irisColor.red, irisColor.green, irisColor.blue, 0.4);
        glowGradient.addColorStopRGBA(1, irisColor.red, irisColor.green, irisColor.blue, 0);
        cr.setSource(glowGradient);
        cr.arc(0, 0, eyeRad * 1.2, 0, TWO_PI);
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
                return new RoboticEyeMode(mode);

            case "lids":
            default:
                return new EyelidMode(mode);
        }
    }
}
