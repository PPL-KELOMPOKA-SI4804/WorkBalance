<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Compensation extends Model
{
    protected $table = 'compensations';

    protected $fillable = [
        'employee_id',
        'period_month',
        'base_salary',
        'allowances',
        'benefits',
        'is_complete',
    ];

    protected function casts(): array
    {
        return [
            'base_salary' => 'decimal:2',
            'allowances' => 'decimal:2',
            'benefits' => 'decimal:2',
            'is_complete' => 'boolean',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }
}
