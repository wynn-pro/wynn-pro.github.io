import math
import random
import sys

import pygame

# --- Settings ---
WIDTH, HEIGHT = 400, 600
FPS = 60

GRAVITY = 0.45
FLAP_STRENGTH = -8
PIPE_SPEED = 3
PIPE_GAP = 160
PIPE_WIDTH = 70
PIPE_SPACING = 220  # horizontal distance between pipes
GROUND_HEIGHT = 80

# Colors
SKY = (112, 197, 206)
GREEN = (94, 184, 64)
DARK_GREEN = (60, 130, 40)
GROUND = (222, 216, 149)
GROUND_DARK = (190, 180, 110)
YELLOW = (250, 210, 50)
ORANGE = (240, 120, 40)
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)

pygame.init()
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Flappy Bird")
clock = pygame.time.Clock()
big_font = pygame.font.SysFont("arial", 48, bold=True)
small_font = pygame.font.SysFont("arial", 22, bold=True)


class Bird:
    def __init__(self):
        self.x = 100
        self.y = HEIGHT // 2
        self.radius = 16
        self.velocity = 0

    def flap(self):
        self.velocity = FLAP_STRENGTH

    def update(self):
        self.velocity += GRAVITY
        self.y += self.velocity

    def rect(self):
        # Slightly smaller than the drawing so collisions feel fair
        r = self.radius - 3
        return pygame.Rect(self.x - r, self.y - r, r * 2, r * 2)

    def draw(self):
        # Tilt the bird based on how fast it's moving
        angle = max(-30, min(60, self.velocity * 4))
        bird_surface = pygame.Surface((50, 40), pygame.SRCALPHA)
        pygame.draw.circle(bird_surface, YELLOW, (25, 20), self.radius)
        pygame.draw.circle(bird_surface, BLACK, (25, 20), self.radius, 2)
        pygame.draw.ellipse(bird_surface, WHITE, (14, 18, 14, 9))  # wing
        pygame.draw.circle(bird_surface, WHITE, (31, 15), 6)  # eye
        pygame.draw.circle(bird_surface, BLACK, (33, 15), 3)  # pupil
        pygame.draw.polygon(bird_surface, ORANGE, [(38, 20), (48, 23), (38, 27)])  # beak
        rotated = pygame.transform.rotate(bird_surface, -angle)
        screen.blit(rotated, rotated.get_rect(center=(self.x, int(self.y))))


class Pipe:
    def __init__(self, x):
        self.x = x
        self.gap_y = random.randint(140, HEIGHT - GROUND_HEIGHT - 140)
        self.passed = False

    def update(self):
        self.x -= PIPE_SPEED

    def top_rect(self):
        return pygame.Rect(self.x, 0, PIPE_WIDTH, self.gap_y - PIPE_GAP // 2)

    def bottom_rect(self):
        top = self.gap_y + PIPE_GAP // 2
        return pygame.Rect(self.x, top, PIPE_WIDTH, HEIGHT - GROUND_HEIGHT - top)

    def draw(self):
        for r in (self.top_rect(), self.bottom_rect()):
            pygame.draw.rect(screen, GREEN, r)
            pygame.draw.rect(screen, DARK_GREEN, r, 3)
        # Pipe "lips"
        top_lip = pygame.Rect(self.x - 5, self.top_rect().bottom - 25, PIPE_WIDTH + 10, 25)
        bottom_lip = pygame.Rect(self.x - 5, self.bottom_rect().top, PIPE_WIDTH + 10, 25)
        for lip in (top_lip, bottom_lip):
            pygame.draw.rect(screen, GREEN, lip)
            pygame.draw.rect(screen, DARK_GREEN, lip, 3)


def draw_ground(offset):
    pygame.draw.rect(screen, GROUND, (0, HEIGHT - GROUND_HEIGHT, WIDTH, GROUND_HEIGHT))
    pygame.draw.rect(screen, GREEN, (0, HEIGHT - GROUND_HEIGHT, WIDTH, 12))
    # Moving stripes so the ground looks like it scrolls
    for x in range(-40, WIDTH + 40, 40):
        sx = x - offset % 40
        pygame.draw.line(screen, GROUND_DARK, (sx, HEIGHT - GROUND_HEIGHT + 20),
                         (sx + 20, HEIGHT - 10), 4)


def draw_text(text, font, y, color=WHITE):
    # Draw text with a black outline so it's readable on any background
    outline = font.render(text, True, BLACK)
    for dx, dy in ((-2, 0), (2, 0), (0, -2), (0, 2)):
        screen.blit(outline, outline.get_rect(center=(WIDTH // 2 + dx, y + dy)))
    surface = font.render(text, True, color)
    screen.blit(surface, surface.get_rect(center=(WIDTH // 2, y)))


def main():
    bird = Bird()
    pipes = []
    score = 0
    high_score = 0
    ground_offset = 0
    state = "start"  # "start", "playing", or "game_over"

    while True:
        # --- Input ---
        for event in pygame.event.get():
            if event.type == pygame.QUIT or (event.type == pygame.KEYDOWN and event.key == pygame.K_ESCAPE):
                pygame.quit()
                sys.exit()

            pressed = (
                (event.type == pygame.KEYDOWN and event.key in (pygame.K_SPACE, pygame.K_UP))
                or event.type == pygame.MOUSEBUTTONDOWN
            )
            if pressed:
                if state in ("start", "playing"):
                    state = "playing"
                    bird.flap()
                elif state == "game_over":
                    bird = Bird()
                    pipes = []
                    score = 0
                    state = "start"

        # --- Update ---
        if state == "playing":
            bird.update()
            ground_offset += PIPE_SPEED

            # Add a new pipe when the last one has moved far enough
            if not pipes or pipes[-1].x < WIDTH - PIPE_SPACING:
                pipes.append(Pipe(WIDTH))

            for pipe in pipes:
                pipe.update()
                if not pipe.passed and pipe.x + PIPE_WIDTH < bird.x:
                    pipe.passed = True
                    score += 1
                if bird.rect().colliderect(pipe.top_rect()) or bird.rect().colliderect(pipe.bottom_rect()):
                    state = "game_over"

            # Remove pipes that are off screen
            pipes = [p for p in pipes if p.x + PIPE_WIDTH > -10]

            # Hit the ground or flew too high
            if bird.y + bird.radius >= HEIGHT - GROUND_HEIGHT or bird.y < -50:
                state = "game_over"

            if state == "game_over":
                high_score = max(high_score, score)

        elif state == "start":
            # Bob up and down gently on the start screen
            bird.y = HEIGHT // 2 + 8 * math.sin(pygame.time.get_ticks() / 200)
            ground_offset += PIPE_SPEED

        elif state == "game_over":
            # Let the bird fall to the ground
            if bird.y + bird.radius < HEIGHT - GROUND_HEIGHT:
                bird.update()

        # --- Draw ---
        screen.fill(SKY)
        for pipe in pipes:
            pipe.draw()
        draw_ground(ground_offset)
        bird.draw()

        if state == "start":
            draw_text("Flappy Bird", big_font, 150, YELLOW)
            draw_text("Press SPACE or click to flap", small_font, 400)
        elif state == "playing":
            draw_text(str(score), big_font, 60)
        elif state == "game_over":
            draw_text("Game Over", big_font, 160, ORANGE)
            draw_text(f"Score: {score}", small_font, 230)
            draw_text(f"Best: {high_score}", small_font, 265)
            draw_text("Press SPACE to play again", small_font, 400)

        pygame.display.flip()
        clock.tick(FPS)


if __name__ == "__main__":
    main()
