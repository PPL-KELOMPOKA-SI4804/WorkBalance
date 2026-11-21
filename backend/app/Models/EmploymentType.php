<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmploymentType extends Model
{
    protected $table = 'employment_types';

    protected $fillable = [
        'name',
        'work_days_per_week',
        'normal_weekly_hours',
    ];

    protected function casts(): array
    {
        return [
            'work_days_per_week' => 'integer',
            'normal_weekly_hours' => 'integer',
        ];
    }

    public function employees(): HasMany
    {
        return $this->hasMany(Employee::class, 'employment_type_id');
    }
}
