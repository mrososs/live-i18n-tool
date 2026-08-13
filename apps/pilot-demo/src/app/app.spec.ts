import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('Pilot demo', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  it('renders the complete three-role workflow shell', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const content = fixture.nativeElement.textContent;
    expect(content).toContain('Content editor');
    expect(content).toContain('Reviewer');
    expect(content).toContain('Developer');
    expect(content).toContain('checkout.title');
  });
});
